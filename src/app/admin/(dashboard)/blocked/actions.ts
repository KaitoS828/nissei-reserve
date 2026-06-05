"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/admin/blocked";

export async function createBlocked(formData: FormData) {
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "休業";

  if (!start || !end) redirect(`${PATH}?error=${encodeURIComponent("開始日・終了日は必須です")}`);
  if (end < start) redirect(`${PATH}?error=${encodeURIComponent("終了日は開始日以降にしてください")}`);

  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").insert({
    start_date: start,
    end_date: end,
    reason,
  });
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

export async function deleteBlocked(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  await supabase.from("blocked_dates").delete().eq("id", id);
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}
