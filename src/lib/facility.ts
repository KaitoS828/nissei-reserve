import { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getDefaultFacilityId(supabase: AdminClient): Promise<string | null> {
  const { data } = await supabase
    .from("facility")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
