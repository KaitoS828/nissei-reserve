import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseUnpaidHold } from "@/lib/hold";

export const dynamic = "force-dynamic";

// 決済画面から戻ってきたお客様の受け皿。
// 「やめた」時点で在庫を解放しないと、その日は他のお客様が予約できないままになる。
// 誰でも叩ける経路なので、未決済の仮予約しか解放しない（releaseUnpaidHold 側で担保）。
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = params.get("id");
  const plan = params.get("plan");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  if (id) {
    await releaseUnpaidHold(
      createAdminClient(),
      id,
      "決済画面から戻られたため解放",
    ).catch(() => false);
  }

  // 元のプランに戻す。日程はそのまま残して、選び直さなくて済むようにする。
  const back = plan
    ? `/reserve/${plan}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    : "/reserve";
  return NextResponse.redirect(new URL(back, req.nextUrl.origin));
}
