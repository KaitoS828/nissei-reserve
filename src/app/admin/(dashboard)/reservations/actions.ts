"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID, randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { bookingGuideHtml, bookingGuideSubject } from "@/lib/booking-guide";
import { reviewRequestHtml, reviewRequestSubject, reviewRequestCustomHtml } from "@/lib/review-request";
import {
  GUIDE_SELECT,
  guideInput,
  guestFullName,
  originFromHeaders,
  type GuideFacility,
  type GuideRow,
} from "@/lib/booking-guide-server";
import { ensureSecretCode, registerUrl } from "@/lib/guest-registration";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReservationCode, canBook } from "@/lib/reservations";
import { eachNight, OCCUPYING_STATUSES } from "@/lib/availability";
import { auditLog } from "@/lib/audit";
import { issueDoorPin, revokeDoorPin } from "@/lib/smart-lock";
import { gcalCreateEvent, gcalDeleteEvent, gcalCreateBlockEvent } from "@/lib/gcal";
import type { ReservationStatus, PaymentStatus } from "@/types/db";

const PATH = "/admin/reservations";

type AdminClient = ReturnType<typeof createAdminClient>;

function redirectError(msg: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
}

// customer_id の指定があればそれを、手入力なら顧客レコードを作成/更新して id を返す
async function resolveCustomerId(
  supabase: AdminClient,
  formData: FormData,
  facilityId: string | null,
): Promise<string | null> {
  const selected = String(formData.get("customer_id") ?? "") || null;
  if (selected) return selected;

  const lastName = String(formData.get("cust_last_name") ?? "").trim();
  const firstName = String(formData.get("cust_first_name") ?? "").trim();
  if (!lastName && !firstName) return null;

  const email = String(formData.get("cust_email") ?? "").trim() || null;
  const phone = String(formData.get("cust_phone") ?? "").trim() || null;
  const fields = {
    facility_id: facilityId,
    last_name: lastName,
    first_name: firstName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };

  if (email) {
    let existingCustomerQuery = supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (facilityId) existingCustomerQuery = existingCustomerQuery.eq("facility_id", facilityId);
    const { data: existing } = await existingCustomerQuery.maybeSingle();
    if (existing) {
      await supabase.from("customers").update(fields).eq("id", existing.id);
      return existing.id;
    }
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert(fields)
    .select("id")
    .single();
  if (error || !created) {
    redirectError(`顧客情報の保存に失敗しました: ${error?.message ?? ""}`);
  }
  return created.id;
}

export async function createReservation(formData: FormData) {
  const supabase = createAdminClient();

  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const planId = String(formData.get("plan_id") ?? "") || null;
  const roomId = String(formData.get("room_id") ?? "") || null;
  const numGuests = Number(formData.get("num_guests") ?? 1);
  const note = String(formData.get("note") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "admin") || "admin";

  if (!roomTypeId || !checkIn || !checkOut) {
    redirectError("客室タイプ・チェックイン・チェックアウトは必須です");
  }
  const nights = eachNight(checkIn, checkOut);
  if (nights.length < 1) {
    redirectError("チェックアウトはチェックインの翌日以降にしてください");
  }

  // 空室チェック。「管理画面（知人・直予約）」は人間が実際の予約を把握して登録するため、
  // iCal取込等のカレンダーブロックは無視し、実際の予約との重複だけを見る。
  const ok = await canBook(roomTypeId, checkIn, checkOut, {
    ignoreBlocked: source === "admin",
  });
  if (!ok) {
    redirectError("指定期間に空きがありません（既に予約が入っています）");
  }

  const { data: roomType } = await supabase
    .from("room_types")
    .select("facility_id, base_price")
    .eq("id", roomTypeId)
    .single();
  const facilityId = (roomType as { facility_id?: string | null } | null)?.facility_id ?? null;

  const customerId = await resolveCustomerId(supabase, formData, facilityId);

  const rawAmount = formData.get("amount");
  const paymentStatus = (String(formData.get("payment_status") ?? "unpaid") || "unpaid") as PaymentStatus;

  // 金額: 入力があればそれを（0円も含む）、空欄なら客室タイプの基本料金×泊数
  let amount = 0;
  if (rawAmount !== null && String(rawAmount).trim() !== "") {
    amount = Number(rawAmount);
    if (isNaN(amount) || amount < 0) amount = 0;
  } else {
    amount = (roomType?.base_price ?? 0) * nights.length;
  }

  const code = generateReservationCode(checkIn);
  const { data: created, error } = await supabase
    .from("reservations")
    .insert({
      code,
      facility_id: facilityId,
      customer_id: customerId,
      plan_id: planId,
      room_type_id: roomTypeId,
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      num_guests: numGuests,
      amount,
      status: "confirmed", // 管理者手動登録は確定扱い
      payment_status: paymentStatus,
      source,
      note,
    })
    .select("id")
    .single();
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");

  // 管理画面からの直予約もGoogleカレンダーに反映する
  let customerName: string | undefined;
  if (customerId) {
    const { data: cust } = await supabase
      .from("customers")
      .select("last_name, first_name")
      .eq("id", customerId)
      .maybeSingle();
    customerName = [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") || undefined;
  }
  const eventId = await gcalCreateEvent({
    code,
    customer: customerName,
    check_in: checkIn,
    check_out: checkOut,
    guests: numGuests,
    amount,
  }).catch(() => null);
  if (eventId && created) {
    await supabase.from("reservations").update({ gcal_event_id: eventId }).eq("id", created.id);
  }

  const redirectTo = String(formData.get("redirect_to") ?? "");
  if (redirectTo) redirect(redirectTo);
}

export async function updateReservation(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id"));
  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const status = String(formData.get("status")) as ReservationStatus;
  const paymentStatus = String(formData.get("payment_status")) as PaymentStatus;
  const planId = String(formData.get("plan_id") ?? "") || null;
  const roomId = String(formData.get("room_id") ?? "") || null;
  const numGuests = Number(formData.get("num_guests") ?? 1);
  const amount = Number(formData.get("amount") ?? 0);
  const source = String(formData.get("source") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const receiptName = String(formData.get("receipt_name") ?? "").trim() || null;

  if (!id || !roomTypeId || !checkIn || !checkOut) {
    redirectError("客室タイプ・チェックイン・チェックアウトは必須です");
  }
  if (eachNight(checkIn, checkOut).length < 1) {
    redirectError("チェックアウトはチェックインの翌日以降にしてください");
  }

  // 客室・日程・在庫消費ステータスへの変化がない編集（人数変更など）は、
  // 元々空きが確保できていた滞在をなぞるだけなので再チェック不要。
  // iCal取込等で事後にブロックが入ると、無関係な項目の編集まで失敗してしまうため。
  const { data: before } = await supabase
    .from("reservations")
    .select("room_type_id, check_in, check_out, status")
    .eq("id", id)
    .maybeSingle();
  const wasOccupying = before
    ? (OCCUPYING_STATUSES as readonly string[]).includes(before.status)
    : false;
  const staySame =
    before &&
    before.room_type_id === roomTypeId &&
    before.check_in === checkIn &&
    before.check_out === checkOut;

  const occupies = (OCCUPYING_STATUSES as readonly string[]).includes(status);
  if (occupies && !(staySame && wasOccupying)) {
    const ok = await canBook(roomTypeId, checkIn, checkOut, {
      excludeReservationId: id,
    });
    if (!ok) redirectError("指定期間に空きがありません");
  }

  const { data: roomType } = await supabase
    .from("room_types")
    .select("facility_id")
    .eq("id", roomTypeId)
    .single();
  const facilityId = (roomType as { facility_id?: string | null } | null)?.facility_id ?? null;
  const customerId = await resolveCustomerId(supabase, formData, facilityId);

  const { error } = await supabase
    .from("reservations")
    .update({
      customer_id: customerId,
      facility_id: facilityId,
      plan_id: planId,
      room_type_id: roomTypeId,
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      num_guests: numGuests,
      amount,
      status,
      payment_status: paymentStatus,
      ...(source ? { source } : {}),
      note,
      receipt_name: receiptName,
    })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
  redirect(PATH);
}

// 知人・特別価格など、プラン料金と異なる任意の金額でカード決済を求めたいときに使う。
// 予約自体はすでに管理画面で確定済みという前提のため、webhook 側では
// 在庫確保やドアPIN発行・案内メール送信はせず、支払い状態の更新だけを行う。
export async function createPaymentLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const amountInput = Number(formData.get("amount") ?? 0);
  if (!id) redirectError("予約が指定されていません");
  if (!Number.isFinite(amountInput) || !Number.isInteger(amountInput) || amountInput < 1) {
    redirectError("金額は1円以上の整数で指定してください");
  }
  // Stripe Checkout の1回あたりの上限に合わせる
  if (amountInput > 9_999_999) redirectError("金額が大きすぎます");

  const supabase = createAdminClient();
  const { data: r } = await supabase
    .from("reservations")
    .select("id, code, check_in, check_out, lookup_token, custom_payment_link_url, customers(email), plans(name)")
    .eq("id", id)
    .single();
  if (!r) redirectError("予約が見つかりません");

  // 決済後の受付/領収書ページで参照するトークン。管理画面からの直予約には無いので無ければ発行する。
  let lookupToken = r.lookup_token as string | null;
  if (!lookupToken) {
    lookupToken = randomUUID();
    await supabase.from("reservations").update({ lookup_token: lookupToken }).eq("id", id);
  }

  // 決済リンクの金額を、予約に記録された金額としても反映しておく（管理画面上の表示と一致させるため）
  await supabase.from("reservations").update({ amount: amountInput }).eq("id", id);

  const custEmail = (r.customers as unknown as { email: string | null } | null)?.email ?? undefined;
  const planName = (r.plans as unknown as { name: string } | null)?.name ?? "ご宿泊";

  const h = await headers();
  const origin = originFromHeaders(h);
  const stripe = getStripe();

  // 再発行時は前回のリンクを無効化する。有効な決済リンクが複数残ると紛らわしいため。
  const prevUrl = r.custom_payment_link_url as string | null;
  const prevSessionId = prevUrl?.match(/\/pay\/(cs_[A-Za-z0-9]+)/)?.[1];
  if (prevSessionId) {
    await stripe.checkout.sessions.expire(prevSessionId).catch(() => {});
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      payment_method_types: ["card"],
      ...(custEmail ? { customer_email: custEmail } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: amountInput,
            product_data: {
              name: `${planName}（特別価格）`,
              description: `${r.check_in} 〜 ${r.check_out} / 予約番号 ${r.code}`,
            },
          },
        },
      ],
      metadata: { reservation_id: id, code: r.code, kind: "admin_custom_payment" },
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      success_url: `${origin}/reserve/complete?code=${r.code}&token=${lookupToken}`,
      cancel_url: `${origin}${PATH}?error=${encodeURIComponent("決済がキャンセルされました")}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "決済リンクの作成に失敗しました";
    redirectError(msg);
  }
  if (!session.url) redirectError("決済リンクの作成に失敗しました");

  // Stripe の Checkout URL はそのままだと長大でLINE等に貼りづらいため、
  // 自ドメイン配下の短いトークンでリダイレクトする。
  const linkToken = randomBytes(8).toString("base64url");
  const linkExpiresAt = new Date((Math.floor(Date.now() / 1000) + 24 * 60 * 60) * 1000).toISOString();
  await supabase
    .from("reservations")
    .update({
      custom_payment_link_token: linkToken,
      custom_payment_link_url: session.url,
      custom_payment_link_expires_at: linkExpiresAt,
    })
    .eq("id", id);
  const shortUrl = `${origin}/pay/${linkToken}`;

  await auditLog(supabase, {
    action: "payment.custom_link_created",
    entityType: "reservations",
    entityId: id,
    summary: `¥${amountInput.toLocaleString()} の決済リンクを発行`,
    metadata: { amount: amountInput, code: r.code },
  });

  revalidatePath(PATH);
  redirect(`${PATH}?pay_url=${encodeURIComponent(shortUrl)}&pay_code=${encodeURIComponent(r.code)}`);
}

export async function archiveReservation(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirectError(error.message);
  await auditLog(supabase, {
    action: "reservation.archive",
    entityType: "reservations",
    entityId: id,
    summary: "予約をアーカイブに移動",
  });
  revalidatePath(PATH);
  revalidatePath("/admin/reservations/archive");
  revalidatePath("/admin/calendar");
}

// アーカイブ済み予約の完全削除。紐づく決済記録・アンケートも消える（Stripe 上の決済は残る）
export async function deleteReservation(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  // 復元できない操作なので、何を消したか削除前に控える
  const { data: target } = await supabase
    .from("reservations")
    .select("code, check_in, check_out, amount, gcal_event_id")
    .eq("id", id)
    .maybeSingle();

  if (target?.gcal_event_id) {
    await gcalDeleteEvent(target.gcal_event_id as string).catch(() => {});
  }

  await supabase.from("payments").delete().eq("reservation_id", id);
  await supabase.from("surveys").delete().eq("reservation_id", id);

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    redirect(`/admin/reservations/archive?error=${encodeURIComponent(error.message)}`);
  }
  await auditLog(supabase, {
    action: "reservation.delete",
    entityType: "reservations",
    entityId: id,
    summary: target
      ? `予約 ${target.code}（${target.check_in}〜${target.check_out}）を完全削除`
      : "予約を完全削除",
    metadata: target ?? {},
  });
  revalidatePath("/admin/reservations/archive");
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/payments");
}

// ドアPINは通常 Stripe の決済確定で自動発行される。
// 現地精算や電話予約など webhook を通らない予約のために、手動の口も用意する。
export async function issueDoorPinManually(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  const { data: resv } = await supabase
    .from("reservations")
    .select("id, code, check_in, check_out, status, customers(last_name, first_name)")
    .eq("id", id)
    .maybeSingle();
  if (!resv) redirectError("予約が見つかりません");
  if (resv.status === "cancelled") redirectError("キャンセル済みの予約には発行できません");

  const { data: facility } = await supabase
    .from("facility")
    .select("check_in_time, check_out_time")
    .limit(1)
    .maybeSingle();

  const cust = resv.customers as unknown as
    | { last_name: string | null; first_name: string | null }
    | null;

  const result = await issueDoorPin({
    reservationId: resv.id as string,
    code: resv.code as string,
    guestName: [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") || null,
    checkIn: resv.check_in as string,
    checkOut: resv.check_out as string,
    checkInTime: (facility?.check_in_time as string | null)?.slice(0, 5),
    checkOutTime: (facility?.check_out_time as string | null)?.slice(0, 5),
  });
  if (!result.ok) redirectError(`ドアPINの発行に失敗しました: ${result.reason}`);

  await auditLog(supabase, {
    action: "door_pin_issue",
    entityType: "reservation",
    entityId: id,
    summary: `${resv.code} のドアPINを手動で発行しました`,
  }).catch(() => {});

  revalidatePath(PATH);
}

export async function revokeDoorPinManually(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  const { data: resv } = await supabase
    .from("reservations")
    .select("code")
    .eq("id", id)
    .maybeSingle();

  await revokeDoorPin(id);

  await auditLog(supabase, {
    action: "door_pin_revoke",
    entityType: "reservation",
    entityId: id,
    summary: `${resv?.code ?? id} のドアPINを無効化しました`,
  }).catch(() => {});

  revalidatePath(PATH);
}

// 予約時メールを予約者に送る。手動予約でも同じ文面を1クリックで送れるようにする。
export async function sendBookingGuideEmail(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  const { data: resv } = await supabase.from("reservations").select(GUIDE_SELECT).eq("id", id).maybeSingle();
  if (!resv) redirectError("予約が見つかりません");

  const row = resv as unknown as GuideRow;
  const to = row.customers?.email?.trim();
  if (!to) redirectError("この予約にはメールアドレスが登録されていません");

  const { data: facility } = await supabase
    .from("facility")
    .select("check_in_time, check_out_time, phone")
    .limit(1)
    .maybeSingle();

  const h = await headers();
  const origin = originFromHeaders(h);
  const secret = await ensureSecretCode(supabase, id);
  const lookupUrl = to
    ? `${origin}/reserve/lookup?code=${encodeURIComponent(row.code)}&email=${encodeURIComponent(to)}`
    : null;
  const input = guideInput(row, facility as GuideFacility, registerUrl(origin, secret), lookupUrl);
  const subject = bookingGuideSubject(guestFullName(row.customers));

  const ok = await sendEmail({ to, subject, html: bookingGuideHtml(input) });

  // 送ったかどうかが分からないと二重送信するので、成否どちらも残す
  await supabase.from("guest_message_deliveries").insert({
    reservation_id: id,
    message_type: "booking_guide",
    channel: "email",
    sent_to: to,
    subject,
    status: ok ? "sent" : "failed",
    error: ok ? null : "送信に失敗しました",
    sent_at: new Date().toISOString(),
  });

  await auditLog(supabase, {
    action: "booking_guide_send",
    entityType: "reservation",
    entityId: id,
    summary: `${row.code} の予約時メールを ${to} へ${ok ? "送信" : "送信失敗"}`,
  }).catch(() => {});

  if (!ok) redirectError("メールの送信に失敗しました。設定をご確認ください");
  revalidatePath(PATH);
  // 押した結果が画面に出ないと、送れたのか分からない
  redirect(`${PATH}?done=${encodeURIComponent(`${to} へ送信しました`)}`);
}

// チェックアウト後のGoogleレビュー（口コミ）依頼メールを送信する
export async function sendReviewRequestEmail(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  const { data: resv } = await supabase
    .from("reservations")
    .select("id, code, check_in, check_out, customers(last_name, first_name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!resv) redirectError("予約が見つかりません");

  const row = resv as unknown as {
    id: string;
    code: string;
    check_in: string;
    check_out: string;
    customers: { last_name: string | null; first_name: string | null; email: string | null } | null;
  };

  const to = row.customers?.email?.trim();
  if (!to) redirectError("この予約にはメールアドレスが登録されていません");

  const { data: facility } = await supabase
    .from("facility")
    .select("phone")
    .limit(1)
    .maybeSingle();

  const customSubject = String(formData.get("custom_subject") ?? "").trim();
  const customBody = String(formData.get("custom_body") ?? "").trim();

  const guestName = guestFullName(row.customers);
  const subject = customSubject || reviewRequestSubject(guestName);
  const html = customBody
    ? reviewRequestCustomHtml(customBody)
    : reviewRequestHtml({
        guestName,
        code: row.code,
        checkIn: row.check_in,
        checkOut: row.check_out,
        phone: (facility?.phone as string | null) ?? null,
      });

  const ok = await sendEmail({ to, subject, html });

  await supabase.from("guest_message_deliveries").insert({
    reservation_id: id,
    message_type: "review_request",
    channel: "email",
    sent_to: to,
    subject,
    status: ok ? "sent" : "failed",
    error: ok ? null : "送信に失敗しました",
    sent_at: new Date().toISOString(),
  });

  await auditLog(supabase, {
    action: "review_request_send",
    entityType: "reservation",
    entityId: id,
    summary: `${row.code} のGoogleレビュー依頼メールを ${to} へ${ok ? "送信" : "送信失敗"}`,
  }).catch(() => {});

  if (!ok) redirectError("メールの送信に失敗しました。設定をご確認ください");
  revalidatePath(PATH);
  redirect(`${PATH}?done=${encodeURIComponent(`${to} へレビュー依頼メールを送信しました`)}`);
}

export async function unarchiveReservation(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) {
    redirect(`/admin/reservations/archive?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/reservations/archive");
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

// まだGoogleカレンダーに反映されていない予約・休業日をまとめて反映する
export async function syncGcalFromReservations(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/admin/calendar").trim() || "/admin/calendar";
  const supabase = createAdminClient();

  // 1. 予約の同期
  // 記録として残すため、チェックアウト済みの過去分もカレンダーに反映する。
  // キャンセル・ノーショーは反映しない。
  const { data: rows } = await supabase
    .from("reservations")
    .select("id, code, check_in, check_out, num_guests, amount, customers(last_name, first_name, email, phone), plans(name)")
    .in("status", [...OCCUPYING_STATUSES, "checked_out"])
    .is("archived_at", null)
    .is("gcal_event_id", null);

  let syncedResv = 0;
  for (const r of rows ?? []) {
    const cust = r.customers as unknown as { last_name: string | null; first_name: string | null; email: string | null; phone: string | null } | null;
    const customerName = [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") || undefined;
    const plan = r.plans as unknown as { name: string } | null;
    const eventId = await gcalCreateEvent({
      code: r.code as string,
      customer: customerName,
      email: cust?.email ?? undefined,
      phone: cust?.phone ?? undefined,
      plan: plan?.name ?? undefined,
      check_in: r.check_in as string,
      check_out: r.check_out as string,
      guests: r.num_guests as number,
      amount: r.amount as number,
    }).catch(() => null);
    if (eventId) {
      await supabase.from("reservations").update({ gcal_event_id: eventId }).eq("id", r.id);
      syncedResv++;
    }
  }

  // 2. 休業日（blocked_dates）の同期（手動設定・AI設定・全館休業など、未同期分）
  const { data: blockedRows } = await supabase
    .from("blocked_dates")
    .select("id, start_date, end_date, reason")
    .is("gcal_event_id", null);

  let syncedBlocked = 0;
  for (const b of blockedRows ?? []) {
    const eventId = await gcalCreateBlockEvent({
      start_date: b.start_date as string,
      end_date: b.end_date as string,
      reason: (b.reason as string) || "休業",
    }).catch(() => null);
    if (eventId) {
      await supabase.from("blocked_dates").update({ gcal_event_id: eventId }).eq("id", b.id);
      syncedBlocked++;
    }
  }

  revalidatePath(PATH);
  revalidatePath("/admin/calendar");

  const [path, query] = redirectTo.split("?");
  const sp = new URLSearchParams(query ?? "");
  const totalResv = rows?.length ?? 0;
  const totalBlocked = blockedRows?.length ?? 0;

  if (totalResv === 0 && totalBlocked === 0) {
    sp.set("done", "Googleカレンダー同期: 未反映の予約・休業日はありませんでした");
  } else {
    const parts: string[] = [];
    if (totalResv > 0) parts.push(`予約: ${syncedResv}/${totalResv}件`);
    if (totalBlocked > 0) parts.push(`休業日: ${syncedBlocked}/${totalBlocked}件`);
    sp.set("done", `Googleカレンダー同期完了（${parts.join(", ")} を反映しました）`);
  }
  redirect(`${path}?${sp.toString()}`);
}
