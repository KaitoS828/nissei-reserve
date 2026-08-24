"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { CHECKOUT_WINDOW_MINUTES } from "@/lib/hold";
import { canBook, generateReservationCode } from "@/lib/reservations";
import { eachNight } from "@/lib/availability";
import { calcPrice, guestRange, nightlyRateForGuests, type Discount, type GuestPrices } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isLocale, localePath, type Locale } from "@/lib/i18n";

// エラーは文言ではなくコードでURLに載せる。表示側で言語ごとに引くため、
// また任意の文字列を画面に出させないため。
function fail(locale: Locale, planId: string, code: string, n?: number): never {
  const q = new URLSearchParams({ plan: planId, error: code });
  if (n !== undefined) q.set("n", String(n));
  redirect(`${localePath(locale, "/reserve/form")}?${q.toString()}`);
}

export async function startCheckout(formData: FormData) {
  const planId = String(formData.get("plan") ?? "");
  const rawLocale = String(formData.get("locale") ?? "ja");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ja";

  // 1回ごとに仮予約レコードとStripeセッションを作るため、連打・空打ちを制限する
  const limited = rateLimit(`checkout:${await clientIp()}`, 5, 10 * 60_000);
  if (!limited.ok) fail(locale, planId, "rate_limited");

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
  const agreePolicy = formData.get("agree_policy") === "on";

  if (!planId || !from || !to) fail(locale, planId, "invalid_plan_dates");
  // HTMLのrequiredは直POSTでバイパス可能なため、サーバ側でも同意チェックを必須にする
  if (!agreePolicy) fail(locale, planId, "agree_required");
  if (!lastName || !firstName || !email) fail(locale, planId, "name_email_required");
  // カナは日本語フォームのみ必須。海外のお客様は書けないため英語版では聞かない。
  if (locale === "ja" && (!lastKana || !firstKana)) fail(locale, planId, "kana_required");
  if (!prefecture || !city || !address) fail(locale, planId, "address_required");
  if (email !== email2) fail(locale, planId, "email_mismatch");
  // メール形式（サーバ側でも検証。HTMLのrequiredは直POSTでバイパス可能なため）
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    fail(locale, planId, "email_format");
  }
  // 日付形式（YYYY-MM-DD のみ許可。不正な値での処理を防ぐ）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    fail(locale, planId, "invalid_dates");
  }
  // 文字数上限（過大入力・不正データ・DoS的ペイロード防止）
  const over =
    lastName.length > 50 || firstName.length > 50 ||
    lastKana.length > 50 || firstKana.length > 50 ||
    phone.length > 30 || (prefecture?.length ?? 0) > 20 ||
    (city?.length ?? 0) > 100 || (address?.length ?? 0) > 200 ||
    (building?.length ?? 0) > 100 || (survey?.length ?? 0) > 2000 ||
    (contact?.length ?? 0) > 2000;
  if (over) fail(locale, planId, "too_long");
  // 人数の範囲チェック（負数・極端な値を弾く）
  if (!Number.isInteger(adults) || adults < 1 || adults > 20) {
    fail(locale, planId, "invalid_guests");
  }
  const nights = eachNight(from, to);
  if (nights.length < 1) fail(locale, planId, "invalid_dates");

  const supabase = createAdminClient();

  // プラン・料金・客室タイプ
  const { data: plan } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, guest_prices, room_type_id)")
    .eq("id", planId)
    .single();
  if (!plan) fail(locale, planId, "plan_not_found");
  const pp = (plan.plan_prices ?? [])[0];
  if (!pp) fail(locale, planId, "price_not_set");
  const roomTypeId: string = pp.room_type_id;
  const facilityId = (plan as { facility_id?: string | null }).facility_id ?? null;

  // プラン別の最低人数チェック（guest_prices の最小キー。例: サウナ付きは2名から）
  const { min: minGuests } = guestRange(pp.guest_prices as GuestPrices, 0);
  if (adults < minGuests) fail(locale, planId, "min_guests", minGuests);

  // 空室再チェック（サーバ側）
  if (!(await canBook(roomTypeId, from, to))) fail(locale, planId, "sold_out");

  // 料金はサーバ側で再計算（人数別単価 × 泊数 → 長期割引）
  const nightly = nightlyRateForGuests(adults, pp.guest_prices as GuestPrices, pp.price_per_night);
  const price = calcPrice(from, to, nightly, (plan.discounts ?? []) as Discount[]);

  // 顧客 upsert（メール一致で再利用）
  let customerId: string;
  let existingCustomerQuery = supabase
    .from("customers")
    .select("id")
    .eq("email", email)
    .limit(1);
  if (facilityId) existingCustomerQuery = existingCustomerQuery.eq("facility_id", facilityId);
  const { data: existing } = await existingCustomerQuery.maybeSingle();
  const custFields = {
    last_name: lastName, first_name: firstName,
    last_name_kana: lastKana || null, first_name_kana: firstKana || null,
    email, phone: phone || null,
    prefecture, city, address, building,
    facility_id: facilityId,
  };
  if (existing) {
    customerId = existing.id;
    await supabase.from("customers").update(custFields).eq("id", customerId);
  } else {
    const { data: created, error } = await supabase
      .from("customers").insert(custFields).select("id").single();
    if (error || !created) fail(locale, planId, "customer_save_failed");
    customerId = created.id;
  }

  // 仮予約作成
  const code = generateReservationCode(from);
  const lookupToken = randomUUID();
  const checkInTime = ciHour && ciMin ? `${ciHour.padStart(2, "0")}:${ciMin.padStart(2, "0")}` : null;
  const { data: resv, error: resErr } = await supabase
    .from("reservations")
    .insert({
      code, facility_id: facilityId, customer_id: customerId, plan_id: planId, room_type_id: roomTypeId,
      check_in: from, check_out: to, num_guests: adults, num_children: 0,
      amount: price.total, status: "pending", payment_status: "unpaid",
      source: "web", check_in_time: checkInTime, survey, note: contact,
      lookup_token: lookupToken,
    })
    .select("id, code")
    .single();
  if (resErr || !resv) fail(locale, planId, "reservation_failed");

  // Stripe Checkout Session
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const stripe = getStripe();
  const nightsLabel =
    locale === "en" ? (price.nights === 1 ? "1 night" : `${price.nights} nights`) : `${price.nights}泊`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // 決済ページ自体も同じ言語で出す
    locale: locale === "en" ? "en" : "ja",
    // カードのみに固定（即時決済）。PayPay 等を将来追加する際は、ここに方式を足す。
    // コンビニ/銀行振込など非同期決済は async_payment_* の処理を実装してから追加すること。
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: price.total,
          product_data: {
            name: `${plan.name}（${nightsLabel}）`,
            description:
              locale === "en"
                ? `${from} – ${to} / Booking number ${resv.code}`
                : `${from} 〜 ${to} / 予約番号 ${resv.code}`,
          },
        },
      },
    ],
    metadata: { reservation_id: resv.id, code: resv.code },
    // 期限切れを Stripe に通知させて、掴んだ在庫を確実に解放する
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_WINDOW_MINUTES * 60,
    success_url: `${origin}${localePath(locale, "/reserve/complete")}?code=${resv.code}&token=${lookupToken}`,
    // 戻ってきた時点で在庫を解放する。戻り先で放置されると他のお客様が予約できない。
    cancel_url: `${origin}/reserve/abandon?id=${resv.id}&plan=${planId}&from=${from}&to=${to}&locale=${locale}`,
  });

  if (!session.url) fail(locale, planId, "checkout_failed");
  redirect(session.url);
}
