import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JOBS: { job: string; label: string; expectHours: number }[] = [
  { job: "ical-import", label: "iCal取込", expectHours: 26 },
  { job: "reminders", label: "前日リマインド", expectHours: 26 },
  { job: "release-holds", label: "仮予約の解放", expectHours: 26 },
  { job: "close-stays", label: "滞在の締め", expectHours: 26 },
];

type Run = {
  id: string; job: string; ok: boolean; duration_ms: number | null;
  summary: unknown; error: string | null; created_at: string;
};

function fmt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export default async function CronPage() {
  const { data, error } = await createAdminClient()
    .from("cron_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const runs = (data ?? []) as Run[];
  const now = Date.now();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">自動実行</h1>
        <p className="mt-1 text-sm text-gray-600">
          毎日自動で動く処理の結果です。失敗するとSlackにも通知されます（最新100件）
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          実行履歴を読み込めません（cron_runs テーブルが未作成の可能性があります）: {error.message}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {JOBS.map(({ job, label, expectHours }) => {
          const last = runs.find((r) => r.job === job);
          const overdue = !last || now - new Date(last.created_at).getTime() > expectHours * 3600_000;
          const state = !last
            ? { text: "実行記録なし", cls: "bg-gray-100 text-gray-700" }
            : !last.ok
              ? { text: "失敗", cls: "bg-red-100 text-red-800" }
              : overdue
                ? { text: "実行が遅れています", cls: "bg-amber-100 text-amber-800" }
                : { text: "正常", cls: "bg-emerald-100 text-emerald-800" };
          return (
            <div key={job} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{label}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${state.cls}`}>{state.text}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                最終実行: {last ? fmt(last.created_at) : "—"}
              </p>
              {last?.error && <p className="mt-1 text-sm text-red-700">{last.error}</p>}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">実行履歴</h2>
        {runs.length === 0 && <p className="text-sm text-gray-600">履歴はまだありません。</p>}
        {runs.map((r) => (
          <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums text-gray-600">{fmt(r.created_at)}</span>
              <span className="font-medium text-gray-900">
                {JOBS.find((j) => j.job === r.job)?.label ?? r.job}
              </span>
              <span className={r.ok ? "text-emerald-700" : "text-red-700"}>{r.ok ? "成功" : "失敗"}</span>
              {r.duration_ms !== null && <span className="text-xs text-gray-500">{r.duration_ms}ms</span>}
            </div>
            {r.error && <p className="mt-1 text-red-700">{r.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
