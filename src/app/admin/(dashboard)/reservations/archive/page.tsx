import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationWithRefs, ReservationStatus } from "@/types/db";
import { unarchiveReservation } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  pending: { label: "仮予約", cls: "bg-gray-800 text-gray-300" },
  confirmed: { label: "確定", cls: "bg-cyan-950 text-cyan-400" },
  checked_in: { label: "チェックイン", cls: "bg-emerald-950 text-emerald-400" },
  checked_out: { label: "チェックアウト", cls: "bg-gray-800 text-gray-400" },
  cancelled: { label: "キャンセル", cls: "bg-red-950 text-red-400" },
  no_show: { label: "ノーショー", cls: "bg-amber-950 text-amber-400" },
};
const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("reservations")
    .select(
      "*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name)",
    )
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  const reservations = (data ?? []) as ReservationWithRefs[];

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">アーカイブ</h1>
          <p className="mt-1 text-sm text-gray-400">アーカイブした予約の一覧・復元</p>
        </div>
        <a href="/admin/reservations" className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">← 予約一覧へ</a>
      </header>

      {error && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-sm text-gray-500">アーカイブされた予約はありません。</p>
        )}
        {reservations.map((r) => {
          const meta = STATUS[r.status] ?? STATUS.pending;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
              <span className="flex flex-wrap items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                <span className="font-mono text-xs text-gray-500">{r.code}</span>
                <span className="font-medium text-white">{custName(r.customers)}</span>
                <span className="text-sm text-gray-400">
                  {r.check_in} → {r.check_out}（{r.nights}泊） / {r.room_types?.name ?? "—"} / ¥{r.amount.toLocaleString()}
                </span>
              </span>
              <form action={unarchiveReservation}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-lg border border-cyan-800 px-3 py-1.5 text-sm text-cyan-300 transition hover:bg-cyan-950/40">復元</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
