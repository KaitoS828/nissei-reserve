import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// 宿泊が終わった予約を checked_out にする。
// 手動運用だと確定のまま残り、実害が出ていた:
//   - 予約リストの「これから」に居座り、実際の滞在済み予約は消える
//   - 宿泊後でもキャンセル画面が開けてしまう
// チェックアウト日「より前」だけを対象にする。実行時刻に依存させないため、
// 当日分は翌日の実行で閉じる（滞在中の予約を誤って閉じない）。
async function handle(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

  // 来館されたか分からない confirmed も閉じる。no_show の判断は宿側に委ねる。
  const { data, error } = await supabase
    .from("reservations")
    .select("id, code, check_out, status")
    .in("status", ["confirmed", "checked_in"])
    .lt("check_out", today)
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const closed: string[] = [];
  for (const r of data ?? []) {
    const { error: upErr } = await supabase
      .from("reservations")
      .update({ status: "checked_out", updated_at: new Date().toISOString() })
      .eq("id", r.id as string)
      // 取得後に状態が変わっていたら書き換えない
      .in("status", ["confirmed", "checked_in"]);
    if (!upErr) closed.push(r.code as string);
  }

  return NextResponse.json({ today, checked: data?.length ?? 0, closed });
}

export const GET = handle;
export const POST = handle;
