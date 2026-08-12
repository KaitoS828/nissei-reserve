import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { releaseUnpaidHold, staleBefore } from "@/lib/hold";

export const dynamic = "force-dynamic";

// 決済されないまま残った仮予約を解放する取りこぼし拾い。
// cancel_url も期限切れ通知も届かないことはある（タブを閉じた、通知が失敗した等）。
// 実際にチェックイン日を過ぎても pending のまま在庫を掴んでいた予約があった。
async function handle(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const cutoff = staleBefore();

  const { data } = await supabase
    .from("reservations")
    .select("id, code, created_at")
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    // 管理画面から入れた予約は決済を待つものではないので対象外
    .eq("source", "web")
    .lt("created_at", cutoff);

  const released: string[] = [];
  for (const r of data ?? []) {
    const ok = await releaseUnpaidHold(
      supabase,
      r.id as string,
      "決済されないまま時間が経過したため解放",
    );
    if (ok) released.push(r.code as string);
  }

  return NextResponse.json({ cutoff, checked: data?.length ?? 0, released });
}

export const GET = handle;
export const POST = handle;
