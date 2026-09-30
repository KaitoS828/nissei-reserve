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
    for (let n = 0; n < r.nights; n++) {
      const row = byDate.get(addDays(r.check_in, n));
      if (!row) continue;
      row[tier] += persons;
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

// 申告期間（12〜2月 / 3〜5月 / 6〜8月 / 9〜11月）と、その納期限（末日）
export const PERIODS = [
  { id: "1", label: "12月〜2月", months: [12, 1, 2], startYearOffset: -1, deadline: (y: number) => `${y}年3月31日` },
  { id: "2", label: "3月〜5月", months: [3, 4, 5], startYearOffset: 0, deadline: (y: number) => `${y}年6月30日` },
  { id: "3", label: "6月〜8月", months: [6, 7, 8], startYearOffset: 0, deadline: (y: number) => `${y}年9月30日` },
  { id: "4", label: "9月〜11月", months: [9, 10, 11], startYearOffset: 0, deadline: (y: number) => `${y}年12月31日` },
] as const;
