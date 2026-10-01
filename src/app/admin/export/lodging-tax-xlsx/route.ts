import { readFile } from "fs/promises";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERIODS, buildMonth, daysInMonth, deadlineDate, paymentFiscalYear, type TaxReservation } from "@/lib/lodging-tax";
import { fillOfficialWorkbook } from "@/lib/lodging-tax-xlsx";

export const dynamic = "force-dynamic";

// 北海道公式の「納入申告書・月計表・納入書」Excelに、設定と集計結果を入れて返す
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
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("reservations")
      .select("check_in, check_out, nights, num_guests, num_children, tax_exempt_persons, amount")
      .in("status", ["confirmed", "checked_in", "checked_out"])
      .is("archived_at", null)
      .gt("check_out", startDate)
      .lte("check_in", endDate),
    supabase.from("lodging_tax_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const reservations = (data ?? []) as TaxReservation[];

  const template = await readFile(path.join(process.cwd(), "src/lib/templates/nounyushinkokusho.xlsx"));
  const [dueMonth, dueDay] = period.due;
  const buf = await fillOfficialWorkbook(template, {
    submittedOn: null,
    operatorAddress: settings?.operator_address ?? "",
    operatorName: settings?.operator_name ?? "",
    corporateNo: settings?.corporate_no ?? "",
    facilityAddress: settings?.facility_address ?? "",
    facilityName: settings?.facility_name ?? "",
    designationNo: settings?.designation_no ?? "",
    fiscalYear: paymentFiscalYear(filingYear, dueMonth, dueDay),
    periodStart: new Date(Date.UTC(first.year, first.month - 1, 1)),
    periodEnd: new Date(Date.UTC(last.year, last.month - 1, daysInMonth(last.year, last.month))),
    dueDate: deadlineDate(filingYear, dueMonth, dueDay),
    months: spans.map((s) => buildMonth(reservations, s.year, s.month, { taxIncluded })),
  });

  const name = `宿泊税_${filingYear}_${period.label}`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lodging-tax-${filingYear}-${period.id}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
    },
  });
}
