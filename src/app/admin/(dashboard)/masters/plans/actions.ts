"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/admin/masters/plans";

export async function createPlan(formData: FormData) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("plans").insert({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    meal_type: String(formData.get("meal_type") ?? "none"),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updatePlan(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      meal_type: String(formData.get("meal_type") ?? "none"),
      sort_order: Number(formData.get("sort_order") ?? 0),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function togglePlanActive(formData: FormData) {
  const id = String(formData.get("id"));
  const next = String(formData.get("is_active")) === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_active: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deletePlan(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function setPlanPrice(formData: FormData) {
  const plan_id = String(formData.get("plan_id"));
  const room_type_id = String(formData.get("room_type_id"));
  const price_per_night = Number(formData.get("price_per_night") ?? 0);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("plan_prices")
    .upsert(
      { plan_id, room_type_id, price_per_night, updated_at: new Date().toISOString() },
      { onConflict: "plan_id,room_type_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
