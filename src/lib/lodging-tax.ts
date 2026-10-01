// 北海道宿泊税（定額）。1人1泊の宿泊料金（税抜）で区分する。根拠: 北海道宿泊税特別徴収事務の手引き（R8.4版）
export const TIERS = [
  { key: "t1", label: "2万円未満", tax: 100 },
  { key: "t2", label: "2万円以上5万円未満", tax: 200 },
  { key: "t3", label: "5万円以上", tax: 500 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export type TaxReservation = {
  check_in: string;
  check_out: string;
  nights: number;
  num_guests: number;
  num_children: number | null;
  tax_exempt_persons?: number | null;
  amount: number;
};

export type DayRow = { date: string; t1: number; t2: number; t3: number; exempt: number; total: number };

export function tierOf(perPersonNight: number): TierKey {
  return perPersonNight < 20000 ? "t1" : perPersonNight < 50000 ? "t2" : "t3";
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 月ごとの宿泊数（延べ人泊）を、宿泊した日ごと・料金区分ごとに数える。
// 宿泊料金は「予約金額 ÷ 泊数 ÷ 人数」を1人1泊の額とみなす（税込の場合は消費税10%を除く）。
export function buildMonth(
  reservations: TaxReservation[],
  year: number,
  month: number,
  opts: { taxIncluded: boolean },
): DayRow[] {
  const mm = String(month).padStart(2, "0");
  const days: DayRow[] = Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
    date: `${year}-${mm}-${String(i + 1).padStart(2, "0")}`,
    t1: 0,
    t2: 0,
    t3: 0,
    exempt: 0,
    total: 0,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const r of reservations) {
    const persons = r.num_guests + (r.num_children ?? 0);
    if (r.amount <= 0 || r.nights <= 0 || persons <= 0) continue;
    const perPersonNight = r.amount / r.nights / persons / (opts.taxIncluded ? 1.1 : 1);
    const tier = tierOf(perPersonNight);
    const exempt = Math.min(Math.max(r.tax_exempt_persons ?? 0, 0), persons);
    for (let n = 0; n < r.nights; n++) {
      const row = byDate.get(addDays(r.check_in, n));
      if (!row) continue;
      row[tier] += persons - exempt;
      row.exempt += exempt;
      row.total += persons;
    }
  }
  return days;
}

export function sumMonth(days: DayRow[]) {
  const totals = { t1: 0, t2: 0, t3: 0, exempt: 0, total: 0 };
  for (const d of days) {
    totals.t1 += d.t1;
    totals.t2 += d.t2;
    totals.t3 += d.t3;
    totals.exempt += d.exempt;
    totals.total += d.total;
  }
  const tax = totals.t1 * 100 + totals.t2 * 200 + totals.t3 * 500;
  return { ...totals, tax };
}

// 納期限＝申告期限。対象期間の末日の翌日ではなく「末日」。末日が土日なら翌平日になる。
// 12月末が期限のもの（9〜11月分）は、法令により翌年1月4日（土日なら翌平日）。祝日は考慮していないので、画面の注記で確認を促す。
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export function deadlineDate(year: number, month: number, day: number): Date {
  const d = month === 12 ? new Date(Date.UTC(year + 1, 0, 4)) : new Date(Date.UTC(year, month - 1, day));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const fmt = (d: Date) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAY[d.getUTCDay()]}）`;

// 払込年度は4月1日〜翌3月31日。納期限の属する年度（令和）
export function paymentFiscalYear(year: number, month: number, day: number): number {
  const d = deadlineDate(year, month, day);
  const y = d.getUTCFullYear() - (d.getUTCMonth() < 3 ? 1 : 0);
  return y - 2018;
}

export const PERIODS = [
  { id: "1", label: "12月〜2月", months: [12, 1, 2], startYearOffset: -1, due: [3, 31], deadline: (y: number) => fmt(deadlineDate(y, 3, 31)), fiscal: (y: number) => paymentFiscalYear(y, 3, 31) },
  { id: "2", label: "3月〜5月", months: [3, 4, 5], startYearOffset: 0, due: [6, 30], deadline: (y: number) => fmt(deadlineDate(y, 6, 30)), fiscal: (y: number) => paymentFiscalYear(y, 6, 30) },
  { id: "3", label: "6月〜8月", months: [6, 7, 8], startYearOffset: 0, due: [9, 30], deadline: (y: number) => fmt(deadlineDate(y, 9, 30)), fiscal: (y: number) => paymentFiscalYear(y, 9, 30) },
  { id: "4", label: "9月〜11月", months: [9, 10, 11], startYearOffset: 0, due: [12, 31], deadline: (y: number) => fmt(deadlineDate(y, 12, 31)), fiscal: (y: number) => paymentFiscalYear(y, 12, 31) },
] as const;

// 申告期間の初日・末日。period.id==="1"（12〜2月）は、12月が申告年の前年になる。
export function periodRange(p: (typeof PERIODS)[number], filingYear: number): { start: string; end: string } {
  const first = p.months[0];
  const last = p.months[p.months.length - 1];
  const fy = p.id === "1" && first === 12 ? filingYear - 1 : filingYear;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${fy}-${pad(first)}-01`, end: `${filingYear}-${pad(last)}-${pad(daysInMonth(filingYear, last))}` };
}

// 今日までに終わった期間のうち、一番新しいもの（申告が必要な期間）
export function latestEndedPeriod(today: string): { period: (typeof PERIODS)[number]; filingYear: number; start: string; end: string } {
  const y = Number(today.slice(0, 4));
  let best: { period: (typeof PERIODS)[number]; filingYear: number; start: string; end: string } | null = null;
  for (const filingYear of [y - 1, y, y + 1]) {
    for (const period of PERIODS) {
      const r = periodRange(period, filingYear);
      if (r.end < today && (!best || r.end > best.end)) best = { period, filingYear, ...r };
    }
  }
  return best!;
}
