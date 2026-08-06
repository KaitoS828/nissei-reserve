import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export async function auditLog(
  supabase: SupabaseAdminClient,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
) {
  let actorEmail: string | null = null;
  try {
    const auth = await createClient();
    const { data } = await auth.auth.getUser();
    actorEmail = data.user?.email ?? null;
  } catch {
    actorEmail = null;
  }

  await supabase.from("audit_logs").insert({
    actor_email: actorEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });
}
