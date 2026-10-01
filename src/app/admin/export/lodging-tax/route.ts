import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import { PERIODS, buildMonth, sumMonth, daysInMonth, type TaxReservation } from "@/lib/lodging-tax";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const period = PERIODS.find((p) => p.id === sp.get("p")) ?? PERIODS[0];
  const filingYear = /^\d{4}$/.test(sp.get("y") ?? "") ? Number(sp.get("y")) : new Date().getFullYear();
  const taxIncluded = sp.get("incl") !== "0";

  const spans = period.months.map((m) => ({ month: m, year: period.id === "1" && m === 12 ? filingYear - 1 : filingYear }));
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

  const rows: unknown[][] = [];
  for (const s of spans) {
    const days = buildMonth(reservations, s.year, s.month, { taxIncluded });
    for (const d of days) rows.push([d.date, d.t1, d.t2, d.t3, d.exempt, d.total]);
    const t = sumMonth(days);
    rows.push([`${s.year}年${s.month}月 合計`, t.t1, t.t2, t.t3, t.exempt, t.total]);
    rows.push([`${s.year}年${s.month}月 税額(円)`, t.t1 * 100, t.t2 * 200, t.t3 * 500, "", t.tax]);
  }

  const csv = toCsv(["日付", "宿泊料金2万円未満(泊)", "2万円以上5万円未満(泊)", "5万円以上(泊)", "課税免除(泊)", "合計(泊)"], rows);
  return csvResponse(`宿泊税月計表-${filingYear}-${period.label}`, csv, `lodging-tax-${filingYear}-${period.id}`);
}
