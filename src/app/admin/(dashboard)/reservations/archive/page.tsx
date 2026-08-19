import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationWithRefs, ReservationStatus } from "@/types/db";
import { unarchiveReservation, deleteReservation } from "../actions";
import { DeleteForm } from "../../_components/DeleteForm";

export const dynamic = "force-dynamic";

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  pending: { label: "仮予約", cls: "bg-gray-100 text-gray-700" },
  confirmed: { label: "確定", cls: "bg-cyan-50 text-cyan-700" },
  checked_in: { label: "チェックイン", cls: "bg-emerald-50 text-emerald-700" },
  checked_out: { label: "チェックアウト", cls: "bg-amber-100 text-amber-900 border border-amber-200" },
  cancelled: { label: "キャンセル", cls: "bg-red-50 text-red-600" },
  no_show: { label: "ノーショー", cls: "bg-purple-100 text-purple-800" },
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
          <h1 className="text-2xl font-semibold text-gray-900">アーカイブ</h1>
          <p className="mt-1 text-sm text-gray-600">アーカイブした予約の一覧・復元</p>
        </div>
        <Link href="/admin/reservations" className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">← 予約一覧へ</Link>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-sm text-gray-500">アーカイブされた予約はありません。</p>
        )}
        {reservations.map((r) => {
          const meta = STATUS[r.status] ?? STATUS.pending;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5">
              <span className="flex flex-wrap items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                <span className="font-mono text-xs text-gray-500">{r.code}</span>
                <span className="font-medium text-gray-900">{custName(r.customers)}</span>
                <span className="text-sm text-gray-600">
                  {r.check_in} → {r.check_out}（{r.nights}泊） / {r.room_types?.name ?? "—"} / ¥{r.amount.toLocaleString()}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <form action={unarchiveReservation}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="rounded-lg border border-cyan-300 px-3 py-1.5 text-sm text-cyan-700 transition hover:bg-cyan-100">復元</SubmitButton>
                </form>
                <DeleteForm
                  action={deleteReservation}
                  id={r.id}
                  label="完全削除"
                  confirmMessage={`予約 ${r.code}（${custName(r.customers)}）を完全に削除します。\n紐づく決済記録も消え、元に戻せません。よろしいですか？`}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
