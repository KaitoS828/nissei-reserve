"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// プランごとのギャラリー写真（複数枚）を保存する。
// masters/plans と site-settings の両方の編集UIから呼ばれる共通処理。
export async function saveGalleryImages(planId: string, images: string[]) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("plans")
    .update({ gallery_images: images })
    .eq("id", planId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/masters/plans");
  revalidatePath("/admin/site-settings");
  revalidatePath("/reserve");
  revalidatePath(`/reserve/${planId}`);
  revalidatePath("/en/reserve");
  revalidatePath(`/en/reserve/${planId}`);
}
