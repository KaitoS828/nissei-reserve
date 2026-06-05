"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { canBook, generateReservationCode } from "@/lib/reservations";
import { eachNight } from "@/lib/availability";
import { calcPrice, type Discount } from "@/lib/pricing";

function fail(planId: string, msg: string): never {
  const q = new URLSearchParams({ error: msg });
  redirect(`/reserve/form?plan=${planId}&${q.toString()}`);
}

export async function startCheckout(formData: FormData) {
  const planId = String(formData.get("plan") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const adults = Number(formData.get("guests") ?? 1);

  const lastName = String(formData.get("last_name") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastKana = String(formData.get("last_name_kana") ?? "").trim();
  const firstKana = String(formData.get("first_name_kana") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const email2 = String(formData.get("email2") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const prefecture = String(formData.get("prefecture") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const building = String(formData.get("building") ?? "").trim() || null;
  const ciHour = String(formData.get("ci_hour") ?? "");
  const ciMin = String(formData.get("ci_min") ?? "");
  const survey = String(formData.get("survey") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;

  if (!planId || !from || !to) fail(planId, "プラン・日程が不正です");
  if (!lastName || !firstName || !email) fail(planId, "氏名・メールは必須です");
  if (email !== email2) fail(planId, "メールアドレスが一致しません");
  const nights = eachNight(from, to);
  if (nights.length < 1) fail(planId, "日程が不正です");

  const supabase = createAdminClient();

  // プラン・料金・客室タイプ
  const { data: plan } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, room_type_id)")
    .eq("id", planId)
    .single();
  if (!plan) fail(planId, "プランが見つかりません");
  const pp = (plan.plan_prices ?? [])[0];
  if (!pp) fail(planId, "料金が設定されていません");
  const roomTypeId: string = pp.room_type_id;

  // 空室再チェック（サーバ側）
  if (!(await canBook(roomTypeId, from, to))) fail(planId, "満室のため予約できません");

  // 料金はサーバ側で再計算
  const price = calcPrice(from, to, pp.price_per_night, (plan.discounts ?? []) as Discount[]);

  // 顧客 upsert（メール一致で再利用）
  let customerId: string;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  const custFields = {
    last_name: lastName, first_name: firstName,
    last_name_kana: lastKana || null, first_name_kana: firstKana || null,
    email, phone: phone || null,
    prefecture, city, address, building,
  };
  if (existing) {
    customerId = existing.id;
    await supabase.from("customers").update(custFields).eq("id", customerId);
  } else {
    const { data: created, error } = await supabase
      .from("customers").insert(custFields).select("id").single();
    if (error || !created) fail(planId, "顧客情報の保存に失敗しました");
    customerId = created.id;
  }

  // 仮予約作成
  const code = generateReservationCode(from);
  const lookupToken = randomUUID();
  const checkInTime = ciHour && ciMin ? `${ciHour.padStart(2, "0")}:${ciMin.padStart(2, "0")}` : null;
  const { data: resv, error: resErr } = await supabase
    .from("reservations")
    .insert({
      code, customer_id: customerId, plan_id: planId, room_type_id: roomTypeId,
      check_in: from, check_out: to, num_guests: adults, num_children: 0,
      amount: price.total, status: "pending", payment_status: "unpaid",
      source: "web", check_in_time: checkInTime, survey, note: contact,
      lookup_token: lookupToken,
    })
    .select("id, code")
    .single();
  if (resErr || !resv) fail(planId, "予約の作成に失敗しました");

  // Stripe Checkout Session
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: price.total,
          product_data: {
            name: `${plan.name}（${price.nights}泊）`,
            description: `${from} 〜 ${to} / 予約番号 ${resv.code}`,
          },
        },
      },
    ],
    metadata: { reservation_id: resv.id, code: resv.code },
    success_url: `${origin}/reserve/complete?code=${resv.code}&token=${lookupToken}`,
    cancel_url: `${origin}/reserve/${planId}?from=${from}&to=${to}`,
  });

  if (!session.url) fail(planId, "決済セッションの作成に失敗しました");
  redirect(session.url);
}
