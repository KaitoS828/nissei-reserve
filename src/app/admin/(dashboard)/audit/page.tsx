import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditLog } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const logs = (data ?? []) as AuditLog[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">操作履歴</h1>
        <p className="mt-1 text-sm text-gray-600">
          予約・予約不可日・決済の主要な変更を記録します（最新200件）
        </p>
      </header>

      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="text-sm text-gray-500">操作履歴はまだありません。</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {log.action}
                </span>
                <span className="font-medium text-gray-900">{log.summary}</span>
              </div>
              <span className="font-mono text-xs text-gray-500">
                {log.created_at.slice(0, 19).replace("T", " ")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>操作者: {log.actor_email ?? "system"}</span>
              <span>
                対象: {log.entity_type}
                {log.entity_id ? ` / ${log.entity_id.slice(0, 8)}` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
