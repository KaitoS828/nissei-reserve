import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationWithRefs } from "@/types/db";

export const dynamic = "force-dynamic";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

export default async function DashboardPage() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  const today = todayStr();
  const supabase = createAdminClient();

  const sel = "*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name)";
  const [checkInsRes, checkOutsRes, openInquiriesRes, upcomingRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(sel)
      .eq("check_in", today)
      .in("status", ["pending", "confirmed", "checked_in"])
      .order("created_at"),
    supabase
      .from("reservations")
      .select(sel)
      .eq("check_out", today)
      .in("status", ["confirmed", "checked_in", "checked_out"])
      .order("created_at"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("reservations")
      .select(sel)
      .gte("check_in", today)
      .in("status", ["pending", "confirmed"])
      .order("check_in")
      .limit(20),
  ]);

  const checkIns = (checkInsRes.data ?? []) as ReservationWithRefs[];
  const checkOuts = (checkOutsRes.data ?? []) as ReservationWithRefs[];
  const upcoming = (upcomingRes.data ?? []) as ReservationWithRefs[];
  const revenue = checkIns.reduce((s, r) => s + (r.amount ?? 0), 0);

  const cards = [
    { label: "本日チェックイン", value: `${checkIns.length}件`, href: "/admin/reservations" },
    { label: "本日チェックアウト", value: `${checkOuts.length}件`, href: "/admin/reservations" },
    { label: "本日チェックイン分の売上", value: `¥${revenue.toLocaleString()}`, href: "/admin/payments" },
    { label: "未対応の問合せ", value: `${openInquiriesRes.count ?? 0}件`, href: "/admin/reservations" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-400">{today}・{user?.email}</p>
        </div>
        <Link href="/admin/reservations" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-cyan-400">
          ＋ 予約を登録
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 transition hover:border-gray-700">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-400">{c.value}</p>
          </Link>
        ))}
      </section>

      {/* 予定しているチェックイン */}
      <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-white">予定しているチェックイン</h2>
          <Link href="/admin/calendar" className="text-xs text-cyan-400 hover:underline">カレンダーで見る →</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">今後の予約はありません</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-cyan-950 px-2 py-1 font-mono text-xs text-cyan-300">{r.check_in}</span>
                  <span className="font-medium text-gray-100">{custName(r.customers)}</span>
                  {r.status === "pending" && (
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">仮予約</span>
                  )}
                </div>
                <span className="text-gray-400">
                  {r.nights}泊 / {r.num_guests}名 / {r.plans?.name ?? "—"}
                  {r.rooms ? ` / ${r.rooms.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="mb-3 font-medium text-white">本日チェックイン</h2>
          {checkIns.length === 0 ? (
            <p className="text-sm text-gray-500">予定なし</p>
          ) : (
            <ul className="space-y-2">
              {checkIns.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-200">{custName(r.customers)}</span>
                  <span className="text-gray-400">{r.room_types?.name ?? "—"}{r.rooms ? ` ${r.rooms.name}` : ""} / {r.num_guests}名</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="mb-3 font-medium text-white">本日チェックアウト</h2>
          {checkOuts.length === 0 ? (
            <p className="text-sm text-gray-500">予定なし</p>
          ) : (
            <ul className="space-y-2">
              {checkOuts.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-200">{custName(r.customers)}</span>
                  <span className="text-gray-400">{r.room_types?.name ?? "—"}{r.rooms ? ` ${r.rooms.name}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
