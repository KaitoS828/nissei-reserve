import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/lib/site";
import { TIERS, PERIODS, buildMonth, sumMonth, daysInMonth, type TaxReservation } from "@/lib/lodging-tax";
import { PrintButton } from "./PrintButton";
import { saveLodgingTaxSettings, saveLodgingTaxFiling } from "./actions";
import { periodRange } from "@/lib/lodging-tax";

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
  searchParams: Promise<{ y?: string; p?: string; incl?: string; done?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const cur = currentPeriod();
  const period = PERIODS.find((p) => p.id === sp.p) ?? PERIODS.find((p) => p.id === cur.id)!;
  const filingYear = /^\d{4}$/.test(sp.y ?? "") ? Number(sp.y) : cur.year;
  const taxIncluded = sp.incl !== "0";

  const spans = period.months.map((m) => ({ month: m, year: monthYear(period, filingYear, m) }));
  const first = spans[0];
  const last = spans[spans.length - 1];
  const startDate = `${first.year}-${String(first.month).padStart(2, "0")}-01`;
  const endDate = `${last.year}-${String(last.month).padStart(2, "0")}-${daysInMonth(last.year, last.month)}`;

  const supabase = createAdminClient();
  const [{ data }, { data: settings }, { data: filing }] = await Promise.all([
    supabase
      .from("reservations")
      .select("check_in, check_out, nights, num_guests, num_children, tax_exempt_persons, amount")
      .in("status", ["confirmed", "checked_in", "checked_out"])
      .is("archived_at", null)
      .gt("check_out", startDate)
      .lte("check_in", endDate),
    supabase.from("lodging_tax_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("lodging_tax_filings").select("*").eq("period_start", periodRange(period, filingYear).start).maybeSingle(),
  ]);
  const reservations = (data ?? []) as TaxReservation[];
  const facilityNo = settings?.designation_no ?? "";
  const facilityName = settings?.facility_name?.trim() || SITE.name;

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
            href={`/admin/export/lodging-tax-xlsx?${exportQs}`}
            className="rounded-lg bg-cyan-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
          >
            公式Excel（申告書・月計表・納入書）
          </a>
          <a
            href={`/admin/export/lodging-tax?${exportQs}`}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
          >
            CSV出力
          </a>
          <PrintButton />
        </div>
      </header>

      {sp.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 print:hidden">{sp.error}</div>}
      {sp.done && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 print:hidden">{sp.done}</div>}

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

      {/* 申告・納入までの手順（北海道「宿泊税納入までの3STEP」） */}
      <section className="rounded-2xl border border-gray-300 bg-white p-6 print:hidden">
        <h2 className="font-semibold text-gray-900">申告・納入までの手順（北海道「宿泊税納入までの3STEP」）</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-900 lg:grid-cols-3">
          <li className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold">STEP 1　特別徴収義務者の登録申請 {facilityNo ? "✅" : "⬜"}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
              <li>経営開始日の5日前まで（令和8年4月1日時点で営業中の方は令和8年4月6日まで）</li>
              <li>添付: 営業許可（旅館業）または住宅宿泊事業の届出番号の通知書の写し、法人の登記事項証明書（個人は住民票）の写し、宿泊約款や宿泊料金を記載した書面の写し</li>
              <li>eLTAX・郵送・持参のいずれか。済むと「特別徴収義務者登録通知書」が届きます。</li>
              <li>通知書の<b>指定番号（12桁）</b>を、下の登録情報に入れてください。</li>
            </ul>
          </li>
          <li className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold">STEP 2　申告（年4回） {filing?.filed_on ? "✅" : "⬜"}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
              <li>「宿泊税月計表」と「宿泊税納入申告書」の<b>両方</b>を提出（宿泊のない月は月計表は不要）。</li>
              <li>この画面の「公式Excel」に、両方（と納入書）が入ります。</li>
              <li>eLTAX・郵送（札幌道税事務所 税務管理部 課税第二課）・持参のいずれか。</li>
              <li>帳簿は申告期限の翌日から5年、書類は2年、保存。</li>
            </ul>
          </li>
          <li className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold">STEP 3　納入 {filing?.paid_on ? "✅" : "⬜"}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-800">
              <li>eLTAX で申告した場合は電子納入ができます。</li>
              <li>それ以外は、納入書（必ず<b>3枚1組</b>）を金融機関で。道内は銀行・信用金庫・信用組合・農協・漁協・郵便局（あおぞら・りそな・商工中金・三井住友信託を除く）。</li>
              <li>納入期限は申告期限と同じです。</li>
            </ul>
          </li>
        </ol>
      </section>

      {/* 特別徴収義務者の登録情報（公式Excelに入ります） */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 print:hidden">
        <h2 className="font-semibold text-gray-900">特別徴収義務者の登録情報</h2>
        <p className="mt-1 text-sm text-gray-700">申告書・月計表・納入書に印字されます。一度入れれば、次回から入力は不要です。</p>
        <form action={saveLodgingTaxSettings} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="ctx_y" value={String(filingYear)} />
            <input type="hidden" name="ctx_p" value={period.id} />
            <input type="hidden" name="ctx_incl" value={taxIncluded ? "1" : "0"} />
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">指定番号（徴収原簿番号・12桁）*</span>
            <input name="designation_no" defaultValue={settings?.designation_no ?? ""} inputMode="numeric" placeholder="登録通知書の番号" className={`${field} w-full`} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">個人番号又は法人番号</span>
            <input name="corporate_no" defaultValue={settings?.corporate_no ?? ""} inputMode="numeric" className={`${field} w-full`} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs text-gray-700">特別徴収義務者の住所（所在地）</span>
            <input name="operator_address" defaultValue={settings?.operator_address ?? ""} className={`${field} w-full`} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs text-gray-700">氏名（名称）・代表者の氏名（法人は法人名と代表者名）</span>
            <input name="operator_name" defaultValue={settings?.operator_name ?? ""} className={`${field} w-full`} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs text-gray-700">宿泊施設の所在地</span>
            <input name="facility_address" defaultValue={settings?.facility_address ?? ""} className={`${field} w-full`} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs text-gray-700">宿泊施設名（営業許可を受けている名称）</span>
            <input name="facility_name" defaultValue={settings?.facility_name ?? ""} placeholder={SITE.name} className={`${field} w-full`} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">保存</button>
          </div>
        </form>
      </section>

      {/* 申告・納入の記録 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 print:hidden">
        <h2 className="font-semibold text-gray-900">申告・納入の記録（{period.label}分）</h2>
        <p className="mt-1 text-sm text-gray-700">提出・納入したら記録してください。未記録のまま期限が近づくと、ダッシュボードの「要対応」に出ます。</p>
        <form action={saveLodgingTaxFiling} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="ctx_y" value={String(filingYear)} />
            <input type="hidden" name="ctx_p" value={period.id} />
            <input type="hidden" name="ctx_incl" value={taxIncluded ? "1" : "0"} />
          <input type="hidden" name="period_start" value={periodRange(period, filingYear).start} />
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">申告書を提出した日</span>
            <input type="date" name="filed_on" defaultValue={filing?.filed_on ?? ""} className={field} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">納入した日</span>
            <input type="date" name="paid_on" defaultValue={filing?.paid_on ?? ""} className={field} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">納入額（円）</span>
            <input type="number" name="amount" min={0} defaultValue={filing?.amount ?? periodTotal} className={`${field} w-32`} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">提出方法</span>
            <select name="method" defaultValue={filing?.method ?? ""} className={field}>
              <option value="">—</option>
              <option value="eltax">eLTAX</option>
              <option value="mail">郵送</option>
              <option value="visit">持参</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-700">メモ</span>
            <input name="note" defaultValue={filing?.note ?? ""} className={`${field} w-56`} />
          </label>
          <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">記録する</button>
        </form>
      </section>

      {/* 申告書への転記用 */}
      <section className="rounded-2xl border border-gray-300 bg-white p-6">
        <h2 className="font-semibold text-gray-900">宿泊税納入申告書（規則様式別記第2号）への転記用</h2>
        <p className="mt-1 text-sm text-gray-700">
          対象期間 {period.label}分 ／ 申告期限・納入期限 <b>{period.deadline(filingYear)}</b> ／ 払込年度 <b>令和{period.fiscal(filingYear)}年度</b>
        </p>
        <p className="mt-1 text-xs text-gray-700">
          期限の末日が土日の場合は翌平日です（祝日は反映していません）。12月末が期限のもの（9〜11月分）は、法令により翌年1月4日になります。
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
