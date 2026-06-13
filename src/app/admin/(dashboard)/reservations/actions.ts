"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReservationCode, canBook } from "@/lib/reservations";
import { eachNight } from "@/lib/availability";

const PATH = "/admin/reservations";

function redirectError(msg: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
}

export async function createReservation(formData: FormData) {
  const supabase = createAdminClient();

  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  let customerId = String(formData.get("customer_id") ?? "") || null;
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

  // 顧客が手入力（新規）の場合は顧客レコードを作成
  if (!customerId) {
    const lastName = String(formData.get("cust_last_name") ?? "").trim();
    const firstName = String(formData.get("cust_first_name") ?? "").trim();
    const email = String(formData.get("cust_email") ?? "").trim() || null;
    const phone = String(formData.get("cust_phone") ?? "").trim() || null;
    if (lastName || firstName) {
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
          customerId = existing.id;
          await supabase.from("customers").update(fields).eq("id", customerId);
        }
      }
      if (!customerId) {
        const { data: created, error: custErr } = await supabase
          .from("customers")
          .insert(fields)
          .select("id")
          .single();
        if (custErr || !created) redirectError(`顧客情報の保存に失敗しました: ${custErr?.message ?? ""}`);
        customerId = created!.id;
      }
    }
  }

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
    source: "admin",
    note,
  });
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");

  const redirectTo = String(formData.get("redirect_to") ?? "");
  if (redirectTo) redirect(redirectTo);
}

export async function updateReservationStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

export async function assignRoom(formData: FormData) {
  const id = String(formData.get("id"));
  const roomId = String(formData.get("room_id") ?? "") || null;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ room_id: roomId })
    .eq("id", id);
  if (error) redirectError(error.message);
  revalidatePath(PATH);
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
