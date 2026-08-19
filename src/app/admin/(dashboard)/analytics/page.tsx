import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationStatus, OperatingCost } from "@/types/db";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CostManager } from "./CostManager";
import { archiveReservationFromAnalytics, unarchiveReservationFromAnalytics } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  status: ReservationStatus;
  payment_status: string;
  amount: number;
  check_in: string;
  check_out: string;
  nights: number;
  num_guests: number;
  source: string | null;
  note: string | null;
  cancel_reason: string | null;
  archived_at: string | null;
  room_types: { name: string } | null;
  customers: {
    last_name: string | null;
    first_name: string | null;
  } | null;
};

const STATUS_ORDER: { key: ReservationStatus; label: string; cls: string; badgeCls: string }[] = [
  { key: "pending", label: "仮予約", cls: "bg-gray-500", badgeCls: "bg-gray-100 text-gray-700" },
  { key: "confirmed", label: "確定", cls: "bg-cyan-600", badgeCls: "bg-cyan-100 text-cyan-800" },
  { key: "checked_in", label: "滞在中", cls: "bg-emerald-500", badgeCls: "bg-emerald-100 text-emerald-800" },
  { key: "checked_out", label: "完了", cls: "bg-amber-400", badgeCls: "bg-amber-100 text-amber-900 border border-amber-200" },
  { key: "cancelled", label: "キャンセル", cls: "bg-red-500", badgeCls: "bg-red-100 text-red-700" },
  { key: "no_show", label: "ノーショー", cls: "bg-purple-500", badgeCls: "bg-purple-100 text-purple-800" },
];

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "未回収",
  paid: "回収済",
  authorized: "オーソリ済",
  partially_refunded: "一部返金",
  refunded: "返金済",
  failed: "決済失敗",
};

const SOURCE_LABELS: Record<string, string> = {
  web: "Web",
  admin: "直予約/手動",
  phone: "電話",
  walkin: "飛込み/現地",
  ical: "iCal",
};

function monthKey(d: string) {
  return d.slice(0, 7);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; done?: string; error?: string }>;
}) {
  const { year: yearParam, month: monthParam, done, error } = await searchParams;
  const supabase = createAdminClient();

  const [{ data: resvData }, { data: costData, error: costError }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, code, status, payment_status, amount, check_in, check_out, nights, num_guests, source, note, cancel_reason, archived_at, customers(last_name, first_name), room_types(name)")
      .order("check_in", { ascending: false }),
    supabase
      .from("operating_costs")
      .select("*")
      .order("year_month", { ascending: false })
      .order("recorded_date", { ascending: false }),
  ]);

  const all = (resvData ?? []) as unknown as Row[];
  const allCosts = (costData ?? []) as OperatingCost[];
  const dbReady = !costError;

  // 期間の指定はチェックイン日で行う。未指定なら今年。
  const years = [...new Set(all.map((r) => r.check_in.slice(0, 4)))].sort().reverse();
  const thisYear = String(new Date().getFullYear());
  const year = yearParam && years.includes(yearParam) ? yearParam : (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const month = monthParam && /^\d{2}$/.test(monthParam) ? monthParam : "";

  // 該当期間の予約（有効と除外済みを分離）
  const periodAll = all.filter((r) =>
    month ? r.check_in.slice(0, 7) === `${year}-${month}` : r.check_in.slice(0, 4) === year,
  );
  const rows = periodAll.filter((r) => !r.archived_at);
  const excludedRows = periodAll.filter((r) => !!r.archived_at);

  const periodLabel = month ? `${year}年${Number(month)}月` : `${year}年`;

  // 経費（コスト）の絞り込み
  const periodCosts = allCosts.filter((c) =>
    month ? c.year_month === `${year}-${month}` : c.year_month.startsWith(`${year}-`),
  );

  const total = rows.length;
  const byStatus = (s: ReservationStatus) => rows.filter((r) => r.status === s).length;
  const revenue = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalCost = periodCosts.reduce((s, c) => s + c.amount, 0);
  const grossProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

  const cancelled = byStatus("cancelled");
  const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;
  const totalNights = rows
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((s, r) => s + (r.nights ?? 0), 0);

  // 選んだ年の12ヶ月の売上とコスト（集計対象のみ）
  const yearRows = all.filter((r) => !r.archived_at && r.check_in.slice(0, 4) === year);
  const yearCosts = allCosts.filter((c) => c.year_month.startsWith(`${year}-`));

  const monthlyStats = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const targetKey = `${year}-${mm}`;
    const mRevenue = yearRows
      .filter((r) => r.payment_status === "paid" && monthKey(r.check_in) === targetKey)
      .reduce((s, r) => s + r.amount, 0);
    const mCost = yearCosts
      .filter((c) => c.year_month === targetKey)
      .reduce((s, c) => s + c.amount, 0);
    const mProfit = mRevenue - mCost;
    return {
      key: targetKey,
      mm,
      label: `${i + 1}`,
      revenue: mRevenue,
      cost: mCost,
      profit: mProfit,
    };
  });

  const maxVal = Math.max(1, ...monthlyStats.map((m) => Math.max(m.revenue, m.cost)));

  const cards = [
    { label: "確定売上", value: `¥${revenue.toLocaleString()}`, color: "text-cyan-700" },
    { label: "経費（コスト）", value: `¥${totalCost.toLocaleString()}`, color: "text-amber-700" },
    {
      label: "粗利益",
      value: `¥${grossProfit.toLocaleString()}`,
      color: grossProfit >= 0 ? "text-emerald-700" : "text-red-600",
      sub: `利益率: ${profitMargin}%`,
    },
    {
      label: "総予約数 / 延べ宿泊",
      value: `${total}件 / ${totalNights}泊`,
      color: "text-gray-900",
      sub: `キャンセル率: ${cancelRate}% (${cancelled}件)`,
    },
  ];

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
          {done}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">集計・分析</h1>
          <p className="mt-1 text-sm text-gray-600">
            売上・経費（コスト）・粗利益・予約の集計（{periodLabel}／チェックイン日集計）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/admin/export/analytics?year=${year}${month ? `&month=${month}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            title={`${periodLabel}のデータをCSV出力`}
          >
            <svg className="h-4 w-4 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {periodLabel}をCSV出力
          </a>
          <a
            href="/admin/export/analytics?year=all"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            title="全期間・全データをまとめてCSV出力"
          >
            <svg className="h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            全期間（全データ）CSV出力
          </a>
        </div>
      </header>

      {/* 期間選択フィルター */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">年:</span>
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
          <span className="text-xs text-gray-500 font-medium">月:</span>
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

      {/* サマリーカード */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${c.color}`}>{c.value}</p>
            {c.sub && <p className="mt-1 text-xs font-medium text-gray-500">{c.sub}</p>}
          </div>
        ))}
      </section>

      {/* グラフ・内訳セクション */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 月別売上とコストの推移 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-900">{year}年の月別推移（売上・経費）</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-cyan-800">
                <span className="inline-block h-3 w-3 rounded bg-cyan-600" /> 売上
              </span>
              <span className="flex items-center gap-1 text-amber-800">
                <span className="inline-block h-3 w-3 rounded bg-amber-500" /> 経費
              </span>
            </div>
          </div>
          <div className="flex h-52 items-end justify-between gap-2 pt-4">
            {monthlyStats.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                <div className="flex w-full items-end justify-center gap-0.5 h-full">
                  <div
                    className="w-1/2 rounded-t bg-cyan-600/80 transition"
                    style={{ height: `${(m.revenue / maxVal) * 100}%` }}
                    title={`${m.mm}月 売上: ¥${m.revenue.toLocaleString()}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-amber-500/80 transition"
                    style={{ height: `${(m.cost / maxVal) * 100}%` }}
                    title={`${m.mm}月 経費: ¥${m.cost.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-gray-500">{m.label}月</span>
              </div>
            ))}
          </div>
        </div>

        {/* ステータス内訳 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-medium text-gray-900">ステータス内訳（{periodLabel}）</h2>
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

      {/* コスト（経費）手打ち管理セクション */}
      <CostManager
        costs={periodCosts}
        currentYear={year}
        currentMonth={month}
        dbReady={dbReady}
      />

      {/* 対象期間の予約明細リスト（折りたたみ式: デフォルトは閉じてすっきり） */}
      <details className="rounded-2xl border border-gray-200 bg-white p-6">
        <summary className="cursor-pointer font-medium text-gray-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>対象期間の予約明細を確認</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              {rows.length}件
            </span>
          </span>
          <span className="text-xs text-cyan-700">クリックで開閉</span>
        </summary>

        <div className="mt-4 border-t border-gray-100 pt-4 overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-medium">
                  <th className="py-2 px-2">予約番号</th>
                  <th className="py-2 px-2">宿泊日</th>
                  <th className="py-2 px-2">予約者名</th>
                  <th className="py-2 px-2">部屋タイプ</th>
                  <th className="py-2 px-2 text-right">金額</th>
                  <th className="py-2 px-2">支払状況</th>
                  <th className="py-2 px-2">経路</th>
                  <th className="py-2 px-2">ステータス</th>
                  <th className="py-2 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {rows.map((r) => {
                  const custName = r.customers
                    ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ") || "（無名）"
                    : "—";
                  const statusInfo = STATUS_ORDER.find((s) => s.key === r.status);

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-2 px-2 font-mono font-medium text-gray-900">{r.code}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {r.check_in} 〜 {r.check_out} ({r.nights}泊)
                      </td>
                      <td className="py-2 px-2">{custName}</td>
                      <td className="py-2 px-2 text-gray-600">{r.room_types?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-right font-semibold tabular-nums">
                        ¥{r.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          r.payment_status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                        }`}>
                          {PAYMENT_LABELS[r.payment_status] ?? r.payment_status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500">
                        {SOURCE_LABELS[r.source ?? ""] ?? r.source ?? "—"}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${statusInfo?.badgeCls ?? "bg-gray-100"}`}>
                          {statusInfo?.label ?? r.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-2.5">
                          <Link
                            href={`/admin/reservations?q=${r.code}`}
                            className="text-cyan-700 hover:underline font-medium"
                            target="_blank"
                          >
                            詳細 ↗
                          </Link>
                          <form action={archiveReservationFromAnalytics} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="code" value={r.code} />
                            <input type="hidden" name="year" value={year} />
                            <input type="hidden" name="month" value={month} />
                            <ConfirmButton
                              danger
                              title="集計から削除（除外）します"
                              message={
                                <div className="space-y-3 text-left">
                                  <p>予約番号: <strong>{r.code}</strong>（{custName} 様）を集計から削除します。</p>
                                  <label className="block text-xs text-gray-700 space-y-1">
                                    <span>除外理由（一言メモ・任意）:</span>
                                    <input
                                      type="text"
                                      name="exclude_reason"
                                      placeholder="例: テスト予約、知人無料、二重登録など"
                                      className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                                    />
                                  </label>
                                  <p className="text-[11px] text-gray-500">※ 売上や予約件数などの集計から除外されます。後から「集計外の予約」から復元することも可能です。</p>
                                </div>
                              }
                              confirmLabel="集計から削除する"
                              className="text-red-600 hover:underline"
                            >
                              集計から削除
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-6 text-xs text-gray-400">対象の予約はありません。</p>
          )}
        </div>
      </details>

      {/* 集計外（除外済み）の予約リスト */}
      {excludedRows.length > 0 && (
        <details className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-6">
          <summary className="cursor-pointer font-medium text-gray-600 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>集計外の予約（除外・アーカイブ済み）</span>
              <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-700">
                {excludedRows.length}件
              </span>
            </span>
            <span className="text-xs text-gray-500">クリックで開閉</span>
          </summary>

          <div className="mt-4 border-t border-gray-200 pt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-medium">
                  <th className="py-2 px-2">予約番号</th>
                  <th className="py-2 px-2">宿泊日</th>
                  <th className="py-2 px-2">予約者名</th>
                  <th className="py-2 px-2 text-right">金額</th>
                  <th className="py-2 px-2">経路</th>
                  <th className="py-2 px-2">除外理由</th>
                  <th className="py-2 px-2">ステータス</th>
                  <th className="py-2 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {excludedRows.map((r) => {
                  const custName = r.customers
                    ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ") || "（無名）"
                    : "—";
                  const reason = r.cancel_reason || r.note || "—";

                  return (
                    <tr key={r.id} className="hover:bg-white transition opacity-80">
                      <td className="py-2 px-2 font-mono font-medium line-through text-gray-500">{r.code}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {r.check_in} 〜 {r.check_out}
                      </td>
                      <td className="py-2 px-2">{custName}</td>
                      <td className="py-2 px-2 text-right font-medium tabular-nums text-gray-500">
                        ¥{r.amount.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-gray-500">
                        {SOURCE_LABELS[r.source ?? ""] ?? r.source ?? "—"}
                      </td>
                      <td className="py-2 px-2 text-gray-600 max-w-xs truncate" title={reason}>
                        {reason}
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-block rounded bg-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                          除外中
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-2.5">
                          <Link
                            href={`/admin/reservations?q=${r.code}`}
                            className="text-gray-600 hover:underline"
                            target="_blank"
                          >
                            詳細 ↗
                          </Link>
                          <form action={unarchiveReservationFromAnalytics} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="code" value={r.code} />
                            <input type="hidden" name="year" value={year} />
                            <input type="hidden" name="month" value={month} />
                            <ConfirmButton
                              title="集計対象に復元します"
                              message={`予約番号: ${r.code} を再び集計対象に復元します。よろしいですか？`}
                              confirmLabel="集計に戻す"
                              className="text-emerald-700 hover:underline font-medium"
                            >
                              集計に戻す
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
