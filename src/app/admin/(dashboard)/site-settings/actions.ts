"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateTopPageSettings(formData: FormData) {
  const supabase = createAdminClient();

  const name = formData.get("name")?.toString().trim() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const phone = formData.get("phone")?.toString().trim() ?? "";
  const hero_title = formData.get("hero_title")?.toString().trim() ?? "";
  const hero_sub = formData.get("hero_sub")?.toString().trim() ?? "";
  const hero_description = formData.get("hero_description")?.toString().trim() ?? "";

  const hero_images_raw = formData.get("hero_images")?.toString() ?? "";
  const hero_images = hero_images_raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const features_raw = formData.get("features")?.toString() ?? "";
  const features = features_raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: facility } = await supabase.from("facility").select("id, settings").limit(1).maybeSingle();

  const currentSettings = (facility?.settings as Record<string, unknown>) ?? {};
  const newSettings = {
    ...currentSettings,
    hero_title,
    hero_sub,
    hero_description,
    hero_images,
    features,
  };

  if (facility?.id) {
    await supabase
      .from("facility")
      .update({ name, address, phone, settings: newSettings })
      .eq("id", facility.id);
  } else {
    await supabase.from("facility").insert({ name, address, phone, settings: newSettings });
  }

  revalidatePath("/reserve");
  revalidatePath("/en/reserve");
  revalidatePath("/admin/site-settings");
}
