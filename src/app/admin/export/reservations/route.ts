import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

// ラベルは管理画面の予約リストと揃える（突き合わせるときに表記が違うと混乱するため）
const STATUS: Record<string, string> = {
  pending: "仮予約",
  confirmed: "確定",
  checked_in: "チェックイン",
  checked_out: "チェックアウト",
  cancelled: "キャンセル",
  no_show: "ノーショー",
};
const PAYMENT: Record<string, string> = {
  unpaid: "未回収",
  paid: "回収済み",
  authorized: "オーソリ済み",
  partially_refunded: "一部返金",
  refunded: "返金済み",
  failed: "決済失敗",
};

type Row = {
  code: string;
  status: string;
  payment_status: string;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  nights: number | null;
  num_guests: number;
  amount: number;
  source: string | null;
  note: string | null;
  cancel_category: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  created_at: string;
  customers: {
    last_name: string | null;
    first_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  plans: { name: string } | null;
  room_types: { name: string } | null;
  rooms: { name: string } | null;
};

function datetime(v: string | null): string {
  return v ? v.slice(0, 19).replace("T", " ") : "";
}

export async function GET() {
  const supabase = createAdminClient();
  // アーカイブ済みも含めて出す。エクスポートで黙って欠けるほうが困るため、
  // 代わりに「アーカイブ」列で判別できるようにする。
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "code,status,payment_status,check_in,check_out,check_in_time,nights,num_guests,amount," +
        "source,note,cancel_category,cancel_reason,cancelled_at,archived_at,created_at," +
        "customers(last_name,first_name,email,phone),plans(name),room_types(name),rooms(name)",
    )
    .order("check_in", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const csv = toCsv(
    [
      "予約番号", "ステータス", "支払状況",
      "チェックイン", "チェックイン時刻", "チェックアウト", "泊数", "人数",
      "金額", "経路", "プラン", "客室タイプ", "客室",
      "予約者名", "メール", "電話",
      "キャンセル理由", "キャンセル詳細", "キャンセル日時",
      "アーカイブ", "備考", "登録日時",
    ],
    rows.map((r) => {
      const c = r.customers;
      return [
        r.code,
        STATUS[r.status] ?? r.status,
        PAYMENT[r.payment_status] ?? r.payment_status,
        r.check_in,
        r.check_in_time?.slice(0, 5),
        r.check_out,
        r.nights,
        r.num_guests,
        r.amount,
        r.source,
        r.plans?.name,
        r.room_types?.name,
        r.rooms?.name,
        c ? [c.last_name, c.first_name].filter(Boolean).join(" ") : "",
        c?.email,
        c?.phone,
        r.cancel_category,
        r.cancel_reason,
        datetime(r.cancelled_at),
        r.archived_at ? "済" : "",
        r.note,
        datetime(r.created_at),
      ];
    }),
  );

  return csvResponse("予約リスト", csv, "reservations");
}
