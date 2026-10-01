import { createAdminClient } from "@/lib/supabase/admin";
import { PERIODS, buildMonth, sumMonth, daysInMonth, type TaxReservation } from "@/lib/lodging-tax";

export const dynamic = "force-dynamic";

// eLTAX「PCdesk Next」の宿泊税納入申告（特例申告・定額）が読み込むCSV。
// 形式は、eLTAXが配布する「データ作成支援ソフト（特別徴収義務者向け・宿泊税）」の出力仕様どおり:
// UTF-8（BOMなし）、全項目をダブルクォートで囲む、1行・39列。
//   1 地方公共団体コード / 2 税事務所コード / 3 所属コード
//   以降、1か月ごとに 14列: 行為年月(西暦YYYYMM) → 申告区分1〜10の宿泊数 → 課税免除の宿泊数 （これを3か月分）
// 北海道の申告区分は 1=2万円未満 / 2=2万円以上5万円未満 / 3=5万円以上（区分4〜10は使わないので空欄）。
const HOKKAIDO = "01000";

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

  const fields: (string | number)[] = [HOKKAIDO, "", ""];
  for (const s of spans) {
    const t = sumMonth(buildMonth(reservations, s.year, s.month, { taxIncluded }));
    fields.push(`${s.year}${String(s.month).padStart(2, "0")}`, t.t1, t.t2, t.t3, "", "", "", "", "", "", "", t.exempt);
  }

  const line = fields.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\r\n";
  return new Response(line, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eltax-lodging-tax-${filingYear}-${period.id}.csv"`,
    },
  });
}
