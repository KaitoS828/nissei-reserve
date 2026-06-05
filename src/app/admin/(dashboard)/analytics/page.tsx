import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type Row = {
  status: ReservationStatus; payment_status: string;
  amount: number; check_in: string; nights: number;
};

const STATUS_ORDER: { key: ReservationStatus; label: string; cls: string }[] = [
  { key: "pending", label: "仮予約", cls: "bg-gray-500" },
  { key: "confirmed", label: "確定", cls: "bg-cyan-500" },
  { key: "checked_in", label: "滞在中", cls: "bg-emerald-500" },
  { key: "checked_out", label: "完了", cls: "bg-gray-400" },
  { key: "cancelled", label: "キャンセル", cls: "bg-red-500" },
  { key: "no_show", label: "ノーショー", cls: "bg-amber-500" },
];

function monthKey(d: string) {
  return d.slice(0, 7);
}

export default async function AnalyticsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservations")
    .select("status, payment_status, amount, check_in, nights");
  const rows = (data ?? []) as Row[];

  const total = rows.length;
  const byStatus = (s: ReservationStatus) => rows.filter((r) => r.status === s).length;
  const revenue = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
  const cancelled = byStatus("cancelled");
  const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;
  const totalNights = rows
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((s, r) => s + (r.nights ?? 0), 0);

  // 直近6ヶ月の売上（チェックイン月・paid）
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getMonth() + 1}月` });
  }
  const monthlyRevenue = months.map((m) => ({
    ...m,
    value: rows.filter((r) => r.payment_status === "paid" && monthKey(r.check_in) === m.key).reduce((s, r) => s + r.amount, 0),
  }));
  const maxRev = Math.max(1, ...monthlyRevenue.map((m) => m.value));

  const cards = [
    { label: "総予約数", value: `${total}件` },
    { label: "確定売上", value: `¥${revenue.toLocaleString()}` },
    { label: "キャンセル率", value: `${cancelRate}%` },
    { label: "延べ宿泊数", value: `${totalNights}泊` },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">集計・分析</h1>
        <p className="mt-1 text-sm text-gray-400">予約・売上・キャンセルの集計</p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-400">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 月別売上 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
          <h2 className="mb-4 font-medium text-white">月別売上（直近6ヶ月）</h2>
          <div className="flex h-48 items-end justify-between gap-3">
            {monthlyRevenue.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-cyan-500/80"
                    style={{ height: `${(m.value / maxRev) * 100}%` }}
                    title={`¥${m.value.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-gray-500">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ステータス内訳 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
          <h2 className="mb-4 font-medium text-white">ステータス内訳</h2>
          <div className="space-y-3">
            {STATUS_ORDER.map((s) => {
              const count = byStatus(s.key);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{s.label}</span>
                    <span className="text-gray-400">{count}件（{pct}%）</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-full ${s.cls}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
