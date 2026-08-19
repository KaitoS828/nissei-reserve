import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import type { ReservationStatus } from "@/types/db";

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
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id,code,status,payment_status,amount,check_in,check_out,nights,num_guests,source,customers(last_name,first_name,email,phone),plans(name),room_types(name)",
    )
    .order("check_in", { ascending: true });

  if (error) return new Response(error.message, { status: 500 });

  const all = (data ?? []) as unknown as Row[];
  const years = [...new Set(all.map((r) => r.check_in.slice(0, 4)))].sort().reverse();
  const thisYear = String(new Date().getFullYear());
  const year = yearParam && years.includes(yearParam) ? yearParam : (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const month = monthParam && /^\d{2}$/.test(monthParam) ? monthParam : "";

  const rows = all.filter((r) =>
    month ? r.check_in.slice(0, 7) === `${year}-${month}` : r.check_in.slice(0, 4) === year,
  );

  const periodLabel = month ? `${year}年${Number(month)}月` : `${year}年`;

  // 予約集計データ明細
  const total = rows.length;
  const revenue = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;
  const totalNights = rows
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((s, r) => s + (r.nights ?? 0), 0);

  // 月別集計（年間）
  const monthlyRows: unknown[][] = [];
  if (!month) {
    for (let i = 1; i <= 12; i++) {
      const mm = String(i).padStart(2, "0");
      const targetMonth = `${year}-${mm}`;
      const mRows = all.filter((r) => r.check_in.slice(0, 7) === targetMonth);
      const mRevenue = mRows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount, 0);
      const mNights = mRows.filter((r) => !["cancelled", "no_show"].includes(r.status)).reduce((s, r) => s + (r.nights ?? 0), 0);
      const mCancel = mRows.filter((r) => r.status === "cancelled").length;
      monthlyRows.push([
        `${year}年${i}月`,
        mRows.length,
        mRevenue,
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

  // CSV構築
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

  // サマリー部分と明細部分を結合
  const summaryBlock: unknown[][] = [
    ["【集計期間】", periodLabel],
    ["【総予約数】", `${total}件`],
    ["【確定売上】", `¥${revenue.toLocaleString()}`],
    ["【延べ宿泊数】", `${totalNights}泊`],
    ["【キャンセル数】", `${cancelled}件`],
    ["【キャンセル率】", `${cancelRate}%`],
    [],
  ];

  if (!month) {
    summaryBlock.push(
      ["--- 月別売上推移 ---"],
      ["対象年月", "総予約件数", "確定売上(円)", "宿泊泊数", "キャンセル件数", "キャンセル率"],
      ...monthlyRows,
      [],
    );
  }

  summaryBlock.push(
    ["--- ステータス内訳 ---"],
    ["ステータス", "件数", "構成比"],
    ...statusSummary,
    [],
    ["--- 対象予約一覧明細 ---"],
  );

  const fullData = [...summaryBlock, csvHeaders, ...reservationRows];
  // toCsv の第1引数はヘッダー、第2引数は行データ
  const csv = toCsv(
    fullData[0] as string[],
    fullData.slice(1),
  );

  const filename = `集計・分析_${periodLabel.replace(/年|月/g, "-").replace(/-$/, "")}`;
  return csvResponse(filename, csv, `analytics_${year}${month ? `_${month}` : ""}`);
}
