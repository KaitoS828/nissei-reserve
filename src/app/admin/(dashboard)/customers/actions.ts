"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultFacilityId } from "@/lib/facility";

const PATH = "/admin/customers";

export async function createCustomer(formData: FormData) {
  const supabase = createAdminClient();
  const facilityId = await getDefaultFacilityId(supabase);
  const { error } = await supabase.from("customers").insert({
    facility_id: facilityId,
    last_name: String(formData.get("last_name") ?? "").trim() || null,
    first_name: String(formData.get("first_name") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customers")
    .update({
      last_name: String(formData.get("last_name") ?? "").trim() || null,
      first_name: String(formData.get("first_name") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleBlacklist(formData: FormData) {
  const id = String(formData.get("id"));
  const next = String(formData.get("is_blacklisted")) === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customers")
    .update({
      is_blacklisted: next,
      blacklist_reason: next
        ? String(formData.get("blacklist_reason") ?? "").trim() || null
        : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// 予約・問い合わせは履歴として残し、顧客への参照だけ外してから削除する
export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();

  await supabase.from("reservations").update({ customer_id: null }).eq("customer_id", id);
  await supabase.from("inquiries").update({ customer_id: null }).eq("customer_id", id);

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
  revalidatePath("/admin/reservations");
}
