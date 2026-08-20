"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/email";
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
import { gcalCreateEvent, gcalDeleteEvent } from "@/lib/gcal";
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
    })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
  redirect(PATH);
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

// まだGoogleカレンダーに反映されていない予約（作成時の同期失敗・過去分など）をまとめて反映する
export async function syncGcalFromReservations(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/admin/calendar").trim() || "/admin/calendar";
  const supabase = createAdminClient();

  // 記録として残すため、チェックアウト済みの過去分もカレンダーに反映する。
  // キャンセル・ノーショーは反映しない。
  const { data: rows } = await supabase
    .from("reservations")
    .select("id, code, check_in, check_out, num_guests, amount, customers(last_name, first_name)")
    .in("status", [...OCCUPYING_STATUSES, "checked_out"])
    .is("archived_at", null)
    .is("gcal_event_id", null);

  let synced = 0;
  for (const r of rows ?? []) {
    const cust = r.customers as unknown as { last_name: string | null; first_name: string | null } | null;
    const customerName = [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") || undefined;
    const eventId = await gcalCreateEvent({
      code: r.code as string,
      customer: customerName,
      check_in: r.check_in as string,
      check_out: r.check_out as string,
      guests: r.num_guests as number,
      amount: r.amount as number,
    }).catch(() => null);
    if (eventId) {
      await supabase.from("reservations").update({ gcal_event_id: eventId }).eq("id", r.id);
      synced++;
    }
  }

  revalidatePath(PATH);
  revalidatePath("/admin/calendar");

  const [path, query] = redirectTo.split("?");
  const sp = new URLSearchParams(query ?? "");
  const total = rows?.length ?? 0;
  if (total === 0) {
    sp.set("done", "Googleカレンダー同期: 未反映の予約はありませんでした");
  } else if (synced < total) {
    sp.set("error", `Googleカレンダー同期: ${synced}/${total}件のみ反映できました（連携設定をご確認ください）`);
  } else {
    sp.set("done", `Googleカレンダー同期: ${synced}件の予約を反映しました`);
  }
  redirect(`${path}?${sp.toString()}`);
}
