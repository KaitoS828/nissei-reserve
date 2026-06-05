"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/admin/masters/room-types";

export async function createRoomType(formData: FormData) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("room_types").insert({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    capacity: Number(formData.get("capacity") ?? 2),
    base_price: Number(formData.get("base_price") ?? 0),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateRoomType(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("room_types")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      capacity: Number(formData.get("capacity") ?? 2),
      base_price: Number(formData.get("base_price") ?? 0),
      sort_order: Number(formData.get("sort_order") ?? 0),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleRoomTypeActive(formData: FormData) {
  const id = String(formData.get("id"));
  const next = String(formData.get("is_active")) === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("room_types")
    .update({ is_active: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteRoomType(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase.from("room_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
