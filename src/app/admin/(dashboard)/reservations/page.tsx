import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ReservationWithRefs,
  RoomType,
  Room,
  Plan,
  Customer,
  ReservationStatus,
} from "@/types/db";
import {
  createReservation,
  updateReservationStatus,
  assignRoom,
  archiveReservation,
} from "./actions";
import { CustomerPicker } from "./CustomerPicker";
import { DateField } from "./DateField";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";
const btnPrimary =
  "rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-950 transition hover:bg-cyan-400";

const STATUS: { value: ReservationStatus; label: string; cls: string }[] = [
  { value: "pending", label: "仮予約", cls: "bg-gray-800 text-gray-300" },
  { value: "confirmed", label: "確定", cls: "bg-cyan-950 text-cyan-400" },
  { value: "checked_in", label: "チェックイン", cls: "bg-emerald-950 text-emerald-400" },
  { value: "checked_out", label: "チェックアウト", cls: "bg-gray-800 text-gray-400" },
  { value: "cancelled", label: "キャンセル", cls: "bg-red-950 text-red-400" },
  { value: "no_show", label: "ノーショー", cls: "bg-amber-950 text-amber-400" },
];
const statusMeta = (s: ReservationStatus) =>
  STATUS.find((x) => x.value === s) ?? STATUS[0];
const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const supabase = createAdminClient();

  let q = supabase
    .from("reservations")
    .select(
      "*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name)",
    )
    .is("archived_at", null)
    .order("check_in", { ascending: false });
  if (status) q = q.eq("status", status);

  const [{ data: resData }, { data: types }, { data: rooms }, { data: plans }, { data: customers }] =
    await Promise.all([
      q,
      supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("rooms").select("*").eq("is_active", true).order("name"),
      supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

  const reservations = (resData ?? []) as ReservationWithRefs[];
  const roomTypes = (types ?? []) as RoomType[];
  const roomList = (rooms ?? []) as Room[];
  const planList = (plans ?? []) as Plan[];
  const customerList = (customers ?? []) as Customer[];

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">予約</h1>
          <p className="mt-1 text-sm text-gray-400">予約の登録・ステータス管理・客室割当</p>
        </div>
        <a href="/admin/reservations/archive" className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">アーカイブ一覧</a>
      </header>

      {error && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {/* 新規予約 */}
      <details className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5" open={reservations.length === 0}>
        <summary className="cursor-pointer font-medium text-white">＋ 新規予約を登録</summary>
        <form action={createReservation} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <CustomerPicker
            customers={customerList.map((c) => ({
              id: c.id,
              label: [c.last_name, c.first_name].filter(Boolean).join(" ") || c.email || c.id.slice(0, 8),
            }))}
          />
          <label className="space-y-1">
            <span className="text-xs text-gray-400">客室タイプ *</span>
            <select name="room_type_id" required className={field}>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-400">プラン</span>
            <select name="plan_id" className={field} defaultValue="">
              <option value="">（未指定）</option>
              {planList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <DateField name="check_in" label="チェックイン *" />
          <DateField name="check_out" label="チェックアウト *" />
          <label className="space-y-1">
            <span className="text-xs text-gray-400">人数</span>
            <input type="number" name="num_guests" min={1} defaultValue={1} className={field} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-400">金額（空欄=自動計算）</span>
            <input type="number" name="amount" min={0} placeholder="基本料金×泊数" className={field} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-400">客室割当（任意）</span>
            <select name="room_id" className={field} defaultValue="">
              <option value="">（後で割当）</option>
              {roomList.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <input name="note" placeholder="メモ（任意）" className={`${field} md:col-span-3`} />
          <button className={btnPrimary}>登録</button>
        </form>
      </details>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-2">
        <a href="/admin/reservations" className={`rounded-full px-3 py-1 text-xs ${!status ? "bg-cyan-500 text-gray-950" : "bg-gray-800 text-gray-300"}`}>すべて</a>
        {STATUS.map((s) => (
          <a key={s.value} href={`/admin/reservations?status=${s.value}`} className={`rounded-full px-3 py-1 text-xs ${status === s.value ? "bg-cyan-500 text-gray-950" : "bg-gray-800 text-gray-300"}`}>
            {s.label}
          </a>
        ))}
      </div>

      {/* 一覧 */}
      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-sm text-gray-500">予約がありません。</p>
        )}
        {reservations.map((r) => {
          const meta = statusMeta(r.status);
          return (
            <details key={r.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                  <span className="font-mono text-xs text-gray-500">{r.code}</span>
                  <span className="font-medium text-white">{custName(r.customers)}</span>
                </span>
                <span className="text-sm text-gray-400">
                  {r.check_in} → {r.check_out}（{r.nights}泊） / {r.room_types?.name ?? "—"}
                  {r.rooms ? ` ${r.rooms.name}` : ""} / ¥{r.amount.toLocaleString()}
                </span>
              </summary>

              <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 md:grid-cols-4">
                  <span>人数: {r.num_guests}名</span>
                  <span>プラン: {r.plans?.name ?? "—"}</span>
                  <span>経路: {r.source}</span>
                  <span>支払: {r.payment_status}</span>
                </div>
                {r.note && <p className="text-sm text-gray-300">メモ: {r.note}</p>}
                {r.status === "cancelled" && (r.cancel_category || r.cancel_reason) && (
                  <p className="text-sm text-red-300">
                    キャンセル理由: {r.cancel_category}
                    {r.cancel_reason ? ` / ${r.cancel_reason}` : ""}
                  </p>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  {/* ステータス変更 */}
                  <form action={updateReservationStatus} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} className={`${field} w-40`}>
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">状態変更</button>
                  </form>

                  {/* 客室割当 */}
                  <form action={assignRoom} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="room_id" defaultValue={r.room_id ?? ""} className={`${field} w-32`}>
                      <option value="">未割当</option>
                      {roomList.map((rm) => (
                        <option key={rm.id} value={rm.id}>{rm.name}</option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">客室割当</button>
                  </form>

                  <form action={archiveReservation}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">アーカイブに移動</button>
                  </form>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
