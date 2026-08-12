import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCUPYING_STATUSES } from "@/lib/availability";
import { buildIcs, stayFromBlocked, stayFromReservation } from "@/lib/ical-export";

export const dynamic = "force-dynamic";

// 自社の予約を .ics で配信する。Airbnb 等の「カレンダーを接続」に登録して、
// 自社で埋まっている日を他所で売られないようにするための口。
//
// 相手先のサーバーが取りに来るので Cookie 認証は使えない。
// 代わりに推測できないトークンを URL に載せる（ICAL_EXPORT_TOKEN）。

function equals(input: string | null, expected: string): boolean {
  if (!input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const expected = process.env.ICAL_EXPORT_TOKEN;
  // 未設定なら「誰でも見られる」ではなく配信しない
  if (!expected) {
    return NextResponse.json({ error: "ICAL_EXPORT_TOKEN が未設定です" }, { status: 503 });
  }
  if (!equals(req.nextUrl.searchParams.get("token"), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // 過ぎた予定を延々と配る意味は無いので、少し前から先だけを出す
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: reservations }, { data: blocked }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, code, check_in, check_out")
      .in("status", OCCUPYING_STATUSES as unknown as string[])
      .is("archived_at", null)
      .gte("check_out", from),
    supabase.from("blocked_dates").select("id, start_date, end_date, reason").gte("end_date", from),
  ]);

  const stays = [
    ...(reservations ?? []).map((r) =>
      stayFromReservation(r as { id: string; code: string; check_in: string; check_out: string }),
    ),
    ...(blocked ?? [])
      // 取り込んだ予定を送り返さない。相手先は自分の予約を既に知っているし、
      // 往復させると同じ予定が二重に見える。
      .filter((b) => !String((b as { reason: string | null }).reason ?? "").startsWith("[ical:"))
      .map((b) => stayFromBlocked(b as { id: string; start_date: string; end_date: string })),
  ];

  return new NextResponse(buildIcs(stays), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nissei.ics"',
      "Cache-Control": "no-store",
    },
  });
}
