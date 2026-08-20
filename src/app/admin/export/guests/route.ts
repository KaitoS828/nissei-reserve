import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import { genderLabel } from "@/lib/guests";

export const dynamic = "force-dynamic";

// 宿泊者名簿の書き出し。保健所への提示や保管を想定しているので、
// 法定の記載事項をそのまま列に並べる。

type Row = {
  guest_order: number;
  full_name: string;
  furigana: string | null;
  address: string | null;
  contact: string | null;
  occupation: string | null;
  gender: string | null;
  birth_date: string | null;
  is_foreign_national: boolean;
  nationality: string | null;
  passport_number: string | null;
  passport_image_url: string | null;
  created_at: string;
  reservations: {
    code: string;
    check_in: string;
    check_out: string;
    num_guests: number;
  } | null;
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const month = params.get("month"); // YYYY-MM
  let from = params.get("from") ?? "";
  let to = params.get("to") ?? "";

  // 月指定はその月の初日〜末日に直す
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    from = `${month}-01`;
    to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservation_guests")
    .select(
      "guest_order, full_name, furigana, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url, created_at, reservations(code, check_in, check_out, num_guests)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  let rows = (data ?? []) as unknown as Row[];
  // 宿泊日は埋め込み先の値なので取得後に絞る
  if (from) rows = rows.filter((g) => (g.reservations?.check_in ?? "") >= from);
  if (to) rows = rows.filter((g) => (g.reservations?.check_in ?? "") <= to);
  rows.sort((a, b) => {
    const d = (a.reservations?.check_in ?? "").localeCompare(b.reservations?.check_in ?? "");
    return d !== 0 ? d : a.guest_order - b.guest_order;
  });

  const csv = toCsv(
    [
      "チェックイン", "チェックアウト", "予約番号", "人数",
      "何人目", "氏名", "フリガナ", "住所", "連絡先", "職業", "生年月日", "性別",
      "国内に住所なし", "国籍", "旅券番号", "旅券の写し", "記入日時",
    ],
    rows.map((g) => [
      g.reservations?.check_in ?? "",
      g.reservations?.check_out ?? "",
      g.reservations?.code ?? "",
      g.reservations?.num_guests ?? "",
      g.guest_order,
      g.full_name,
      g.furigana ?? "",
      g.address ?? "",
      g.contact ?? "",
      g.occupation ?? "",
      g.birth_date ?? "",
      genderLabel(g.gender),
      g.is_foreign_national ? "該当" : "",
      g.nationality ?? "",
      g.passport_number ?? "",
      // 画像は非公開なので、URLではなく提出の有無だけを出す
      g.is_foreign_national ? (g.passport_image_url ? "提出済み" : "未提出") : "",
      g.created_at,
    ]),
  );

  const label = month ? `宿泊者名簿-${month}` : "宿泊者名簿";
  return csvResponse(label, csv, "guest-registry");
}
