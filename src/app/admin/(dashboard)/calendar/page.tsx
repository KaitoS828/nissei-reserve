import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationWithRefs, RoomType, Plan, Customer } from "@/types/db";
import { OCCUPYING_STATUSES } from "@/lib/availability";
import { createReservation } from "../reservations/actions";
import { CustomerPicker } from "../reservations/CustomerPicker";
import { DateField } from "../reservations/DateField";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + 1));
}
function addMonths(year: number, month0: number, delta: number) {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; new?: string; error?: string }>;
}) {
  const { month, new: newDate, error } = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month0 = now.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    year = y;
    month0 = m - 1;
  }

  const firstDay = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const rangeFrom = ymd(firstDay);
  const rangeTo = ymd(new Date(year, month0, daysInMonth + 1)); // 翌月1日

  const supabase = createAdminClient();
  const [{ count: roomCount }, { data: resData }, { data: blockedData }] =
    await Promise.all([
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("reservations")
        .select("*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name)")
        .in("status", OCCUPYING_STATUSES as unknown as string[])
        .is("archived_at", null)
        .lt("check_in", rangeTo)
        .gt("check_out", rangeFrom),
      supabase
        .from("blocked_dates")
        .select("start_date, end_date, room_type_id")
        .lte("start_date", rangeTo)
        .gte("end_date", rangeFrom),
    ]);

  const totalRooms = roomCount ?? 0;
  const reservations = (resData ?? []) as ReservationWithRefs[];
  const blocked = blockedData ?? [];

  // 新規予約フォーム用マスタ（日付クリック時のみ取得）
  const showNewForm = !!newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate);
  let roomTypes: RoomType[] = [];
  let planList: Plan[] = [];
  let customerList: Customer[] = [];
  if (showNewForm) {
    const [types, plans, customers] = await Promise.all([
      supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    roomTypes = (types.data ?? []) as RoomType[];
    planList = (plans.data ?? []) as Plan[];
    customerList = (customers.data ?? []) as Customer[];
  }

  // 各日のデータを作る
  type DayCell = { date: string; day: number; resv: ReservationWithRefs[]; avail: number; isBlocked: boolean };
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(new Date(year, month0, day));
    const resv = reservations.filter((r) => r.check_in <= date && date < r.check_out);
    const dayBlocked = blocked.filter((b) => b.start_date <= date && date <= b.end_date);
    const globalBlocked = dayBlocked.some((b) => b.room_type_id === null);
    const avail = globalBlocked
      ? 0
      : Math.max(0, totalRooms - resv.length - dayBlocked.length);
    cells.push({ date, day, resv, avail, isBlocked: globalBlocked });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = addMonths(year, month0, -1);
  const next = addMonths(year, month0, 1);
  const monthStr = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
  const todayStr = ymd(now);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">予約カレンダー</h1>
          <p className="mt-1 text-sm text-gray-400">各日の予約と空き室数（全{totalRooms}室）</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar?month=${monthStr(prev.year, prev.month0)}`} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800">← 前月</Link>
          <span className="min-w-28 text-center font-medium text-white">{year}年{month0 + 1}月</span>
          <Link href={`/admin/calendar?month=${monthStr(next.year, next.month0)}`} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800">翌月 →</Link>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showNewForm && (
        <div className="rounded-2xl border border-cyan-900/60 bg-gray-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-white">＋ {newDate} の予約を登録</h2>
            <Link href={`/admin/calendar?month=${monthStr(year, month0)}`} className="text-sm text-gray-400 hover:text-gray-200">閉じる</Link>
          </div>
          <form action={createReservation} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input type="hidden" name="redirect_to" value={`/admin/calendar?month=${monthStr(year, month0)}`} />
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
            <DateField name="check_in" label="チェックイン *" defaultValue={newDate} />
            <DateField name="check_out" label="チェックアウト *" defaultValue={nextDay(newDate!)} />
            <label className="space-y-1">
              <span className="text-xs text-gray-400">人数</span>
              <input type="number" name="num_guests" min={1} defaultValue={1} className={field} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">金額（空欄=自動計算）</span>
              <input type="number" name="amount" min={0} placeholder="基本料金×泊数" className={field} />
            </label>
            <input name="note" placeholder="メモ（任意）" className={`${field} md:col-span-3`} />
            <button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-950 transition hover:bg-cyan-400">登録</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-800 bg-gray-800">
        {WEEK.map((w, i) => (
          <div key={w} className={`bg-gray-900 px-2 py-2 text-center text-xs font-medium ${i === 0 ? "text-red-400" : i === 6 ? "text-cyan-400" : "text-gray-400"}`}>
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="min-h-28 bg-gray-950/40" />;
          const isToday = cell.date === todayStr;
          return (
            <div key={i} className={`min-h-28 space-y-1 bg-gray-900/60 p-1.5 ${isToday ? "ring-1 ring-inset ring-cyan-400" : ""}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? "font-bold text-cyan-400" : "text-gray-400"}`}>{cell.day}</span>
                {cell.isBlocked ? (
                  <span className="rounded bg-red-950 px-1 text-[10px] text-red-400">休</span>
                ) : (
                  <span className={`rounded px-1 text-[10px] ${cell.avail === 0 ? "bg-red-950 text-red-400" : "bg-gray-800 text-gray-400"}`}>空{cell.avail}</span>
                )}
              </div>
              {cell.resv.slice(0, 3).map((r) => (
                <Link key={r.id} href="/admin/reservations" className="block truncate rounded bg-cyan-950/60 px-1 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-900/60">
                  {r.rooms?.name ? `${r.rooms.name} ` : ""}
                  {r.customers ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join("") || "予約" : "予約"}
                </Link>
              ))}
              {cell.resv.length > 3 && (
                <span className="text-[10px] text-gray-500">+{cell.resv.length - 3}件</span>
              )}
              <Link href={`/admin/calendar?month=${monthStr(year, month0)}&new=${cell.date}`} className="block rounded px-1 py-0.5 text-[10px] text-gray-500 transition hover:bg-gray-800 hover:text-cyan-300">＋ 予約</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
