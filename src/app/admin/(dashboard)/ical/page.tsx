import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IcalSource, RoomType } from "@/types/db";
import { importIcal, saveIcalSource, toggleIcalSource } from "./actions";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";

function formatSynced(value: string | null): string {
  if (!value) return "未取り込み";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export default async function IcalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const supabase = createAdminClient();
  const [{ data: sourcesData }, { data: roomsData }, { data: logsData }] = await Promise.all([
    supabase.from("ical_sources").select("*").order("created_at", { ascending: false }),
    supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("ical_import_logs")
      .select("id, ical_source_id, status, imported_count, error, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const sources = (sourcesData ?? []) as IcalSource[];
  const roomTypes = (roomsData ?? []) as RoomType[];
  const logs = (logsData ?? []) as {
    id: string; ical_source_id: string | null; status: string;
    imported_count: number; error: string | null; created_at: string;
  }[];
  const roomName = (id: string | null) => roomTypes.find((r) => r.id === id)?.name ?? "全客室";
  const sourceName = (id: string | null) => sources.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">iCal連携（外部カレンダー取り込み）</h1>
        <p className="mt-1 text-sm text-gray-600">
          Airbnb や Booking.com の予約を取り込んで、自社サイトとの二重予約を防ぎます。
          取り込んだ予定は「予約不可日」として公開カレンダーに反映されます。
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {done && <p className="rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{done}</p>}

      <form
        action={saveIcalSource}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-4"
      >
        <label className="space-y-1">
          <span className="text-xs text-gray-600">名称</span>
          <input name="name" placeholder="Airbnb" required className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-600">対象の客室タイプ</span>
          <select name="room_type_id" defaultValue="" className={field}>
            <option value="">全客室</option>
            {roomTypes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-gray-600">iCal の URL</span>
          <input name="url" placeholder="https://www.airbnb.jp/calendar/ical/....ics" required className={field} />
        </label>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-xs text-gray-600">メモ</span>
          <input name="note" placeholder="任意" className={field} />
        </label>
        <div className="flex items-end">
          <SubmitButton className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
            連携先を追加
          </SubmitButton>
        </div>
      </form>

      {sources.length > 0 && (
        <form action={importIcal}>
          <SubmitButton className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700">
            有効な連携先をすべて取り込む
          </SubmitButton>
        </form>
      )}

      <div className="space-y-3">
        {sources.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            連携先がまだありません。Airbnb の「カレンダーをエクスポート」で取得した URL を登録してください。
          </p>
        )}

        {sources.map((source) => (
          <details key={source.id} className="rounded-2xl border border-gray-200 bg-white p-5">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    source.is_active ? "bg-cyan-50 text-cyan-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {source.is_active ? "有効" : "無効"}
                </span>
                <span className="font-medium text-gray-900">{source.name}</span>
              </span>
              <span className="text-sm text-gray-600">
                {roomName(source.room_type_id)} / 最終取り込み {formatSynced(source.last_synced_at)}
              </span>
            </summary>

            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
              <form action={saveIcalSource} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={source.id} />
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">名称</span>
                  <input name="name" defaultValue={source.name} className={field} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">対象の客室タイプ</span>
                  <select name="room_type_id" defaultValue={source.room_type_id ?? ""} className={field}>
                    <option value="">全客室</option>
                    {roomTypes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-gray-600">iCal の URL</span>
                  <input name="url" defaultValue={source.url} className={field} />
                </label>
                <label className="space-y-1 sm:col-span-3">
                  <span className="text-xs text-gray-600">メモ</span>
                  <input name="note" defaultValue={source.note ?? ""} className={field} />
                </label>
                <div className="flex items-end">
                  <SubmitButton className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
                    保存
                  </SubmitButton>
                </div>
              </form>

              <div className="flex flex-wrap gap-2">
                <form action={importIcal}>
                  <input type="hidden" name="id" value={source.id} />
                  <SubmitButton className="rounded-lg border border-cyan-300 px-3 py-1.5 text-sm text-cyan-700 transition hover:bg-cyan-50">
                    この連携先を取り込む
                  </SubmitButton>
                </form>
                <form action={toggleIcalSource}>
                  <input type="hidden" name="id" value={source.id} />
                  <input type="hidden" name="is_active" value={String(!source.is_active)} />
                  <SubmitButton className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50">
                    {source.is_active ? "無効化" : "有効化"}
                  </SubmitButton>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>

      {logs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-900">取り込み履歴</h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">日時</th>
                  <th className="px-4 py-2">連携先</th>
                  <th className="px-4 py-2">結果</th>
                  <th className="px-4 py-2">件数</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-600">{formatSynced(log.created_at)}</td>
                    <td className="px-4 py-2 text-gray-900">{sourceName(log.ical_source_id)}</td>
                    <td className="px-4 py-2">
                      {log.status === "success" ? (
                        <span className="text-cyan-700">成功</span>
                      ) : (
                        <span className="text-red-600">失敗{log.error ? `: ${log.error}` : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{log.imported_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
