import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/lib/site";
import { TIERS, PERIODS, buildMonth, sumMonth, daysInMonth, type TaxReservation } from "@/lib/lodging-tax";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const field =
  "rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const n = (v: number) => v.toLocaleString();

// 申告期間の各月について、実際の暦年を返す（12月分は申告年の前年）
function monthYear(period: (typeof PERIODS)[number], filingYear: number, month: number) {
  return period.id === "1" && month === 12 ? filingYear - 1 : filingYear;
}

function currentPeriod(): { id: string; year: number } {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (m === 12) return { id: "1", year: y + 1 };
  if (m <= 2) return { id: "1", year: y };
  if (m <= 5) return { id: "2", year: y };
  if (m <= 8) return { id: "3", year: y };
  return { id: "4", year: y };
}

export default async function LodgingTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; p?: string; no?: string; name?: string; incl?: string }>;
}) {
  const sp = await searchParams;
  const cur = currentPeriod();
  const period = PERIODS.find((p) => p.id === sp.p) ?? PERIODS.find((p) => p.id === cur.id)!;
  const filingYear = /^\d{4}$/.test(sp.y ?? "") ? Number(sp.y) : cur.year;
  const taxIncluded = sp.incl !== "0";
  const facilityNo = sp.no ?? "";
  const facilityName = sp.name?.trim() || SITE.name;

  const spans = period.months.map((m) => ({ month: m, year: monthYear(period, filingYear, m) }));
  const first = spans[0];
  const last = spans[spans.length - 1];
  const startDate = `${first.year}-${String(first.month).padStart(2, "0")}-01`;
  const endDate = `${last.year}-${String(last.month).padStart(2, "0")}-${daysInMonth(last.year, last.month)}`;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservations")
    .select("check_in, check_out, nights, num_guests, num_children, tax_exempt_persons, amount")
    .in("status", ["confirmed", "checked_in", "checked_out"])
    .is("archived_at", null)
    .gt("check_out", startDate)
    .lte("check_in", endDate);
  const reservations = (data ?? []) as TaxReservation[];

  const months = spans.map((s) => {
    const days = buildMonth(reservations, s.year, s.month, { taxIncluded });
    return { ...s, days, sum: sumMonth(days) };
  });
  const periodTotal = months.reduce((a, m) => a + m.sum.tax, 0);
  const exportQs = new URLSearchParams({ y: String(filingYear), p: period.id, incl: taxIncluded ? "1" : "0" }).toString();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">宿泊税（北海道）</h1>
          <p className="mt-1 text-sm text-gray-700">
            申告書に添付する「宿泊税月計表」と、申告書へ転記する数字を作ります。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/export/lodging-tax?${exportQs}`}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
          >
            CSV出力
          </a>
          <PrintButton />
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 print:hidden">
        <label className="space-y-1">
          <span className="block text-xs text-gray-700">申告年（納期限の年）</span>
          <input name="y" type="number" defaultValue={filingYear} className={`${field} w-28`} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-700">対象期間</span>
          <select name="p" defaultValue={period.id} className={field}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}分（納期限 {p.deadline(filingYear)}）
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-700">指定番号（徴収原簿番号）</span>
          <input name="no" defaultValue={facilityNo} placeholder="登録通知書の番号" className={`${field} w-48`} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-700">宿泊施設名（営業許可の名称）</span>
          <input name="name" defaultValue={facilityName} className={`${field} w-64`} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-700">予約金額の扱い</span>
          <select name="incl" defaultValue={taxIncluded ? "1" : "0"} className={field}>
            <option value="1">消費税込み（税抜に直して判定）</option>
            <option value="0">消費税抜き</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          表示
        </button>
      </form>

      {/* 申告書への転記用 */}
      <section className="rounded-2xl border border-gray-300 bg-white p-6">
        <h2 className="font-semibold text-gray-900">宿泊税納入申告書（規則様式別記第2号）への転記用</h2>
        <p className="mt-1 text-sm text-gray-700">
          対象期間 {period.label}分 ／ 申告期限・納入期限 <b>{period.deadline(filingYear)}</b>
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
            <thead>
              <tr className="bg-gray-100 text-gray-900">
                <th className="border border-gray-300 px-3 py-2 text-left">宿泊月</th>
                {TIERS.map((t) => (
                  <th key={t.key} className="border border-gray-300 px-3 py-2 text-right">
                    {t.label}（{t.tax}円）
                  </th>
                ))}
                <th className="border border-gray-300 px-3 py-2 text-right">課税免除</th>
                <th className="border border-gray-300 px-3 py-2 text-right">税額</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={`${m.year}-${m.month}`}>
                  <td className="border border-gray-300 px-3 py-2">{m.year}年{m.month}月</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{n(m.sum.t1)}泊</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{n(m.sum.t2)}泊</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{n(m.sum.t3)}泊</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{n(m.sum.exempt)}泊</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">¥{n(m.sum.tax)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold text-gray-900">
                <td className="border border-gray-300 px-3 py-2">合計</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{n(months.reduce((a, m) => a + m.sum.t1, 0))}泊</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{n(months.reduce((a, m) => a + m.sum.t2, 0))}泊</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{n(months.reduce((a, m) => a + m.sum.t3, 0))}泊</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{n(months.reduce((a, m) => a + m.sum.exempt, 0))}泊</td>
                <td className="border border-gray-300 px-3 py-2 text-right">¥{n(periodTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-700">
          宿泊数は「延べ人数 × 泊数」（1人1泊を1泊と数える）です。納入額は <b>¥{n(periodTotal)}</b>。
          {periodTotal === 0 && "（税額0円でも納入申告書の提出は必要です。この場合、月計表の添付は不要です。）"}
        </p>
      </section>

      {/* 宿泊税月計表（添付書類）。月ごとに1枚 */}
      {months.map((m) => (
        <section key={`${m.year}-${m.month}`} className="break-before-page rounded-2xl border border-gray-300 bg-white p-6 print:border-0 print:p-0">
          <h2 className="font-semibold text-gray-900">宿泊税月計表</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-sm text-gray-900 sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-gray-700">施設番号（指定番号）</dt><dd className="font-medium">{facilityNo || "（未入力）"}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-700">宿泊施設名</dt><dd className="font-medium">{facilityName}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-700">対象</dt><dd className="font-medium">令和{m.year - 2018}年 {m.month}月分</dd></div>
          </dl>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm tabular-nums">
              <thead>
                <tr className="bg-gray-100 text-gray-900">
                  <th className="border border-gray-300 px-2 py-1.5">日付</th>
                  <th className="border border-gray-300 px-2 py-1.5">宿泊料金が2万円未満</th>
                  <th className="border border-gray-300 px-2 py-1.5">2万円以上5万円未満</th>
                  <th className="border border-gray-300 px-2 py-1.5">5万円以上</th>
                  <th className="border border-gray-300 px-2 py-1.5">課税免除</th>
                  <th className="border border-gray-300 px-2 py-1.5">合計</th>
                </tr>
              </thead>
              <tbody>
                {m.days.map((d, i) => (
                  <tr key={d.date}>
                    <td className="border border-gray-300 px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{d.t1 ? `${n(d.t1)}泊` : ""}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{d.t2 ? `${n(d.t2)}泊` : ""}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{d.t3 ? `${n(d.t3)}泊` : ""}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{d.exempt ? `${n(d.exempt)}泊` : ""}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{d.total ? `${n(d.total)}泊` : ""}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold text-gray-900">
                  <td className="border border-gray-300 px-2 py-1.5 text-center">合計（泊）</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t1)}泊</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t2)}泊</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t3)}泊</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.exempt)}泊</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.total)}泊</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-2 py-1.5 text-center">税率（円）</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">100円</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">200円</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">500円</td>
                  <td className="border border-gray-300 px-2 py-1.5" />
                  <td className="border border-gray-300 px-2 py-1.5" />
                </tr>
                <tr className="font-semibold text-gray-900">
                  <td className="border border-gray-300 px-2 py-1.5 text-center">税額（円）</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t1 * 100)}円</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t2 * 200)}円</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.t3 * 500)}円</td>
                  <td className="border border-gray-300 px-2 py-1.5" />
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{n(m.sum.tax)}円</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-gray-900 print:hidden">
        <h2 className="mb-2 font-semibold">この計算の前提（提出前に確認してください）</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>対象の予約は、確定・滞在中・退室済で、金額が0円でないものです。キャンセル・ノーショー・集計対象外（アーカイブ）は含みません。</li>
          <li>1人1泊の宿泊料金は、予約金額 ÷ 泊数 ÷ 人数で求めます。予約金額は宿泊料金と清掃料金です（手引きでは、宿泊者の意思に関わりなく請求される清掃代は宿泊料金に含まれます）。飲食代や送迎料などが金額に入っている予約は、その分を除いて判定が必要です。</li>
          <li>課税免除（修学旅行など）は、予約の編集画面の「宿泊税の課税免除（人数）」に入れた人数が、免除の宿泊数として集計されます。免除の証明書（修学旅行等であることの証明書）は、北海道税務課のページからダウンロードして保管してください。</li>
          <li>OTA経由の予約は、宿泊税を販売価格に含める・現地で別に徴収する、のどちらでも、宿泊者から預かる税額は同じです。納入は宿の責任で行います。</li>
          <li>公式の納入申告書と納入書（3枚1組）は、北海道税務課のページからダウンロードして使います。eLTAX で申告する場合は、上の「転記用」の数字を入力してください。</li>
        </ul>
      </section>
    </div>
  );
}
