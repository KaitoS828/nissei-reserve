import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type Row = {
  status: ReservationStatus; payment_status: string;
  amount: number; check_in: string; nights: number;
};

const STATUS_ORDER: { key: ReservationStatus; label: string; cls: string }[] = [
  { key: "pending", label: "仮予約", cls: "bg-gray-500" },
  { key: "confirmed", label: "確定", cls: "bg-cyan-600" },
  { key: "checked_in", label: "滞在中", cls: "bg-emerald-500" },
  { key: "checked_out", label: "完了", cls: "bg-gray-400" },
  { key: "cancelled", label: "キャンセル", cls: "bg-red-500" },
  { key: "no_show", label: "ノーショー", cls: "bg-amber-500" },
];

function monthKey(d: string) {
  return d.slice(0, 7);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservations")
    .select("status, payment_status, amount, check_in, nights");
  const all = (data ?? []) as Row[];

  // 期間の指定はチェックイン日で行う。未指定なら今年。
  const years = [...new Set(all.map((r) => r.check_in.slice(0, 4)))].sort().reverse();
  const thisYear = String(new Date().getFullYear());
  const year = yearParam && years.includes(yearParam) ? yearParam : (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const month = monthParam && /^\d{2}$/.test(monthParam) ? monthParam : "";

  const rows = all.filter((r) =>
    month ? r.check_in.slice(0, 7) === `${year}-${month}` : r.check_in.slice(0, 4) === year,
  );
  const periodLabel = month ? `${year}年${Number(month)}月` : `${year}年`;

  const total = rows.length;
  const byStatus = (s: ReservationStatus) => rows.filter((r) => r.status === s).length;
  const revenue = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
  const cancelled = byStatus("cancelled");
  const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;
  const totalNights = rows
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((s, r) => s + (r.nights ?? 0), 0);

  // 選んだ年の12ヶ月。月を選んでいても年間の推移は出す（比較できるように）。
  const yearRows = all.filter((r) => r.check_in.slice(0, 4) === year);
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return {
      key: `${year}-${mm}`,
      mm,
      label: `${i + 1}`,
      value: yearRows
        .filter((r) => r.payment_status === "paid" && monthKey(r.check_in) === `${year}-${mm}`)
        .reduce((s, r) => s + r.amount, 0),
    };
  });
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
        <h1 className="text-2xl font-semibold text-gray-900">集計・分析</h1>
        <p className="mt-1 text-sm text-gray-600">
          予約・売上・キャンセルの集計（{periodLabel}／チェックイン日で集計）
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">年</span>
          {years.map((y) => (
            <Link
              key={y}
              href={`/admin/analytics?year=${y}`}
              className={`rounded-full px-3 py-1 text-sm transition ${
                y === year ? "bg-cyan-600 font-medium text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {y}年
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">月</span>
          <Link
            href={`/admin/analytics?year=${year}`}
            className={`rounded-full px-3 py-1 text-sm transition ${
              !month ? "bg-cyan-600 font-medium text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            通年
          </Link>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((mm) => (
            <Link
              key={mm}
              href={`/admin/analytics?year=${year}&month=${mm}`}
              className={`rounded-full px-3 py-1 text-sm transition ${
                mm === month ? "bg-cyan-600 font-medium text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {Number(mm)}月
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-700">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 月別売上 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-medium text-gray-900">{year}年の月別売上</h2>
          <div className="flex h-48 items-end justify-between gap-3">
            {monthlyRevenue.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-cyan-600/80"
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
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-medium text-gray-900">ステータス内訳</h2>
          <div className="space-y-3">
            {STATUS_ORDER.map((s) => {
              const count = byStatus(s.key);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{s.label}</span>
                    <span className="text-gray-600">{count}件（{pct}%）</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
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
