"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/admin/masters/rooms";

export async function createRoom(formData: FormData) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").insert({
    name: String(formData.get("name") ?? "").trim(),
    room_type_id: String(formData.get("room_type_id") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateRoom(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rooms")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      room_type_id: String(formData.get("room_type_id") ?? "") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleRoomActive(formData: FormData) {
  const id = String(formData.get("id"));
  const next = String(formData.get("is_active")) === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rooms")
    .update({ is_active: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteRoom(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
