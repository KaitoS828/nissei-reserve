import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBlocked, deleteBlocked } from "./actions";

export const dynamic = "force-dynamic";

type Blocked = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blocked_dates")
    .select("id, start_date, end_date, reason")
    .order("start_date", { ascending: true });
  const blocks = (data ?? []) as Blocked[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">予約不可日（休業日）</h1>
        <p className="mt-1 text-sm text-gray-600">
          設定した期間は公開サイトのカレンダーで「満室・予約不可」になります
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* 追加フォーム */}
      <form
        action={createBlocked}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-4"
      >
        <label className="space-y-1">
          <span className="text-xs text-gray-600">開始日</span>
          <input type="date" name="start_date" required className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">終了日</span>
          <input type="date" name="end_date" required className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">理由</span>
          <input name="reason" placeholder="休業 / メンテナンス等" className={field} />
        </label>
        <div className="flex items-end">
          <SubmitButton className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
            予約不可に設定
          </SubmitButton>
        </div>
      </form>

      {/* 一覧 */}
      <div className="space-y-2">
        {blocks.length === 0 && <p className="text-sm text-gray-500">設定された予約不可日はありません。</p>}
        {blocks.map((b) => {
          // 連携由来の行は手で消しても次の取り込みで戻るので、解除させない
          const icalSummary = b.reason?.match(/^\[ical:[^\]]+\]\s*(.*)$/)?.[1];
          const isSync = b.reason === "gcal-sync" || icalSummary !== undefined;
          const label =
            icalSummary !== undefined
              ? `iCal連携${icalSummary ? `: ${icalSummary}` : ""}`
              : b.reason === "gcal-sync"
                ? "Googleカレンダー連携"
                : b.reason;
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono text-gray-800">
                  {b.start_date}
                  {b.end_date !== b.start_date ? ` 〜 ${b.end_date}` : ""}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{label}</span>
              </div>
              {!isSync && (
                <form action={deleteBlocked}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 transition hover:bg-red-100">
                    解除
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
