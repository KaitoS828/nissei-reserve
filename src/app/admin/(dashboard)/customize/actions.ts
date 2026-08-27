"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBrandColorKey } from "@/lib/brand-colors";

export async function updateBrandColor(formData: FormData) {
  const value = formData.get("brand_color")?.toString() ?? "";
  if (!isBrandColorKey(value)) return;

  const supabase = createAdminClient();
  const { data: facility } = await supabase.from("facility").select("id, settings").limit(1).maybeSingle();
  if (!facility?.id) return;

  const currentSettings = (facility.settings as Record<string, unknown>) ?? {};
  await supabase
    .from("facility")
    .update({ settings: { ...currentSettings, brand_color: value } })
    .eq("id", facility.id);

  revalidatePath("/", "layout");
}
