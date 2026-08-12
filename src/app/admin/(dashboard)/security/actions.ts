"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function unenrollFactor(formData: FormData) {
  const factorId = String(formData.get("factor_id") ?? "");
  if (!factorId) throw new Error("factor_id が必要です");

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/security");
}
