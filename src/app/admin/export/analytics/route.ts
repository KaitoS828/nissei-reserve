import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import type { ReservationStatus, OperatingCost } from "@/types/db";

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
  plans: { name: string } | null;
  room_types: { name: string } | null;
  customers: {
    last_name: string | null;
    first_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "仮予約",
  confirmed: "確定",
  checked_in: "滞在中",
  checked_out: "完了",
  cancelled: "キャンセル",
  no_show: "ノーショー",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "未回収",
  paid: "回収済み",
  authorized: "オーソリ済み",
  partially_refunded: "一部返金",
  refunded: "返金済み",
  failed: "決済失敗",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const supabase = createAdminClient();

  const [{ data: resvData, error: resvError }, { data: costData }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id,code,status,payment_status,amount,check_in,check_out,nights,num_guests,source,customers(last_name,first_name,email,phone),plans(name),room_types(name)",
      )
      .is("archived_at", null)
      .order("check_in", { ascending: true }),
    supabase
      .from("operating_costs")
      .select("*")
      .order("year_month", { ascending: true })
      .order("recorded_date", { ascending: true }),
  ]);

  if (resvError) return new Response(resvError.message, { status: 500 });

  const all = (resvData ?? []) as unknown as Row[];
  const allCosts = (costData ?? []) as OperatingCost[];

  const years = [...new Set(all.map((r) => r.check_in.slice(0, 4)))].sort().reverse();
  const isAllPeriod = yearParam === "all";
  const thisYear = String(new Date().getFullYear());
  const year = isAllPeriod
    ? "all"
    : yearParam && years.includes(yearParam)
      ? yearParam
      : (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const month = !isAllPeriod && monthParam && /^\d{2}$/.test(monthParam) ? monthParam : "";

  let rows: Row[] = [];
  let periodCosts: OperatingCost[] = [];
  let periodLabel = "";

  if (isAllPeriod) {
    rows = all;
    periodCosts = allCosts;
    periodLabel = "全期間（全データ）";
  } else if (month) {
    rows = all.filter((r) => r.check_in.slice(0, 7) === `${year}-${month}`);
    periodCosts = allCosts.filter((c) => c.year_month === `${year}-${month}`);
    periodLabel = `${year}年${Number(month)}月`;
  } else {
    rows = all.filter((r) => r.check_in.slice(0, 4) === year);
    periodCosts = allCosts.filter((c) => c.year_month.startsWith(`${year}-`));
    periodLabel = `${year}年（通年）`;
  }

  // 予約・売上集計
  const total = rows.length;
  const revenue = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalCost = periodCosts.reduce((s, c) => s + c.amount, 0);
  const grossProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? `${Math.round((grossProfit / revenue) * 100)}%` : "0%";

  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const cancelRate = total ? `${Math.round((cancelled / total) * 100)}%` : "0%";
  const totalNights = rows
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((s, r) => s + (r.nights ?? 0), 0);

  // 月別集計
  const monthlyRows: unknown[][] = [];
  if (isAllPeriod) {
    // 全期間に存在する年月を昇順で抽出
    const allMonths = [
      ...new Set([
        ...all.map((r) => r.check_in.slice(0, 7)),
        ...allCosts.map((c) => c.year_month),
      ]),
    ].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();

    for (const ym of allMonths) {
      const mRows = all.filter((r) => r.check_in.slice(0, 7) === ym);
      const mRevenue = mRows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
      const mCost = allCosts.filter((c) => c.year_month === ym).reduce((s, c) => s + c.amount, 0);
      const mProfit = mRevenue - mCost;
      const mNights = mRows.filter((r) => !["cancelled", "no_show"].includes(r.status)).reduce((s, r) => s + (r.nights ?? 0), 0);
      const mCancel = mRows.filter((r) => r.status === "cancelled").length;
      monthlyRows.push([
        ym,
        mRevenue,
        mCost,
        mProfit,
        mRows.length,
        mNights,
        mCancel,
        mRows.length ? `${Math.round((mCancel / mRows.length) * 100)}%` : "0%",
      ]);
    }
  } else if (!month) {
    for (let i = 1; i <= 12; i++) {
      const mm = String(i).padStart(2, "0");
      const targetMonth = `${year}-${mm}`;
      const mRows = all.filter((r) => r.check_in.slice(0, 7) === targetMonth);
      const mRevenue = mRows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
      const mCost = allCosts.filter((c) => c.year_month === targetMonth).reduce((s, c) => s + c.amount, 0);
      const mProfit = mRevenue - mCost;
      const mNights = mRows.filter((r) => !["cancelled", "no_show"].includes(r.status)).reduce((s, r) => s + (r.nights ?? 0), 0);
      const mCancel = mRows.filter((r) => r.status === "cancelled").length;
      monthlyRows.push([
        `${year}年${i}月`,
        mRevenue,
        mCost,
        mProfit,
        mRows.length,
        mNights,
        mCancel,
        mRows.length ? `${Math.round((mCancel / mRows.length) * 100)}%` : "0%",
      ]);
    }
  }

  // ステータス内訳
  const statusSummary = Object.entries(STATUS_LABELS).map(([key, label]) => {
    const count = rows.filter((r) => r.status === key).length;
    const pct = total ? `${Math.round((count / total) * 100)}%` : "0%";
    return [label, count, pct];
  });

  // サマリーブロック
  const summaryBlock: unknown[][] = [
    ["【集計期間】", periodLabel],
    ["【確定売上】", `¥${revenue.toLocaleString()}`],
    ["【経費合計（コスト）】", `¥${totalCost.toLocaleString()}`],
    ["【粗利益】", `¥${grossProfit.toLocaleString()}`],
    ["【粗利益率】", profitMargin],
    ["【総予約数】", `${total}件`],
    ["【延べ宿泊数】", `${totalNights}泊`],
    ["【キャンセル数】", `${cancelled}件`],
    ["【キャンセル率】", cancelRate],
    [],
  ];

  if (!month) {
    summaryBlock.push(
      [isAllPeriod ? "--- 全期間 月別売上・コスト推移 ---" : `--- ${year}年 月別売上・コスト推移 ---`],
      ["対象年月", "確定売上(円)", "経費コスト(円)", "粗利益(円)", "予約件数", "宿泊泊数", "キャンセル件数", "キャンセル率"],
      ...monthlyRows,
      [],
    );
  }

  summaryBlock.push(
    ["--- ステータス内訳 ---"],
    ["ステータス", "件数", "構成比"],
    ...statusSummary,
    [],
  );

  // コスト一覧明細
  if (periodCosts.length > 0) {
    summaryBlock.push(
      ["--- 登録経費（コスト）明細 ---"],
      ["対象年月", "カテゴリ", "金額(円)", "発生日", "備考"],
      ...periodCosts.map((c) => [c.year_month, c.category, c.amount, c.recorded_date ?? "", c.description ?? ""]),
      [],
    );
  }

  // 予約一覧明細
  const csvHeaders = [
    "予約番号",
    "ステータス",
    "支払状況",
    "チェックイン",
    "チェックアウト",
    "泊数",
    "人数",
    "金額",
    "予約者名",
    "メール",
    "電話",
    "プラン",
    "客室タイプ",
    "予約経路",
  ];

  const reservationRows = rows.map((r) => {
    const c = r.customers;
    return [
      r.code,
      STATUS_LABELS[r.status] ?? r.status,
      PAYMENT_LABELS[r.payment_status] ?? r.payment_status,
      r.check_in,
      r.check_out,
      r.nights,
      r.num_guests,
      r.amount,
      c ? [c.last_name, c.first_name].filter(Boolean).join(" ") : "",
      c?.email ?? "",
      c?.phone ?? "",
      r.plans?.name ?? "",
      r.room_types?.name ?? "",
      r.source ?? "",
    ];
  });

  summaryBlock.push(["--- 対象予約一覧明細 ---"]);

  const fullData = [...summaryBlock, csvHeaders, ...reservationRows];
  const csv = toCsv(
    fullData[0] as string[],
    fullData.slice(1),
  );

  const filePrefix = isAllPeriod ? "集計・分析_全期間" : `集計・分析_${periodLabel.replace(/年|月/g, "-").replace(/-$/, "")}`;
  const asciiName = isAllPeriod ? "analytics_all" : `analytics_${year}${month ? `_${month}` : ""}`;
  return csvResponse(filePrefix, csv, asciiName);
}
