"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReservationCode, canBook } from "@/lib/reservations";
import { eachNight, OCCUPYING_STATUSES } from "@/lib/availability";
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
): Promise<string | null> {
  const selected = String(formData.get("customer_id") ?? "") || null;
  if (selected) return selected;

  const lastName = String(formData.get("cust_last_name") ?? "").trim();
  const firstName = String(formData.get("cust_first_name") ?? "").trim();
  if (!lastName && !firstName) return null;

  const email = String(formData.get("cust_email") ?? "").trim() || null;
  const phone = String(formData.get("cust_phone") ?? "").trim() || null;
  const fields = {
    last_name: lastName,
    first_name: firstName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };

  if (email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
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
  const amountInput = Number(formData.get("amount") ?? 0);

  if (!roomTypeId || !checkIn || !checkOut) {
    redirectError("客室タイプ・チェックイン・チェックアウトは必須です");
  }
  const nights = eachNight(checkIn, checkOut);
  if (nights.length < 1) {
    redirectError("チェックアウトはチェックインの翌日以降にしてください");
  }

  // 空室チェック
  const ok = await canBook(roomTypeId, checkIn, checkOut);
  if (!ok) {
    redirectError("指定期間に空きがありません");
  }

  const customerId = await resolveCustomerId(supabase, formData);

  // 金額: 入力があればそれを、無ければ客室タイプの基本料金×泊数
  let amount = amountInput;
  if (!amount || amount <= 0) {
    const { data: rt } = await supabase
      .from("room_types")
      .select("base_price")
      .eq("id", roomTypeId)
      .single();
    amount = (rt?.base_price ?? 0) * nights.length;
  }

  const { error } = await supabase.from("reservations").insert({
    code: generateReservationCode(checkIn),
    customer_id: customerId,
    plan_id: planId,
    room_type_id: roomTypeId,
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
    num_guests: numGuests,
    amount,
    status: "confirmed", // 管理者手動登録は確定扱い
    payment_status: (String(formData.get("payment_status") ?? "unpaid") || "unpaid") as PaymentStatus,
    source: "admin",
    note,
  });
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");

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
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!id || !roomTypeId || !checkIn || !checkOut) {
    redirectError("客室タイプ・チェックイン・チェックアウトは必須です");
  }
  if (eachNight(checkIn, checkOut).length < 1) {
    redirectError("チェックアウトはチェックインの翌日以降にしてください");
  }

  // 在庫を消費するステータスのときだけ、自分自身を除いた空室チェックを行う
  const occupies = (OCCUPYING_STATUSES as readonly string[]).includes(status);
  if (occupies) {
    const ok = await canBook(roomTypeId, checkIn, checkOut, {
      excludeReservationId: id,
    });
    if (!ok) redirectError("指定期間に空きがありません");
  }

  const customerId = await resolveCustomerId(supabase, formData);

  const { error } = await supabase
    .from("reservations")
    .update({
      customer_id: customerId,
      plan_id: planId,
      room_type_id: roomTypeId,
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      num_guests: numGuests,
      amount,
      status,
      payment_status: paymentStatus,
      note,
    })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

export async function archiveReservation(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/reservations/archive");
  revalidatePath("/admin/calendar");
}

// アーカイブ済み予約の完全削除。紐づく決済記録・アンケートも消える（Stripe 上の決済は残る）
export async function deleteReservation(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  await supabase.from("payments").delete().eq("reservation_id", id);
  await supabase.from("surveys").delete().eq("reservation_id", id);

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    redirect(`/admin/reservations/archive?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/reservations/archive");
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/payments");
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
