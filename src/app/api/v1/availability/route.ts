import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTypeAvailability } from "@/lib/reservations";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

// 公開・認証不要（既存の /api/availability と同じデータだが、外部連携向けにJSON構造を明示）
export async function GET(req: NextRequest) {
  const limited = rateLimit(`v1-availability:${ipFromRequest(req)}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "リクエストが多すぎます" }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from/to は必須です（YYYY-MM-DD）" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: roomType } = await supabase
    .from("room_types")
    .select("id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!roomType) return NextResponse.json({ days: {} });

  const avail = await getTypeAvailability(roomType.id, from, to);
  const days: Record<string, boolean> = {};
  for (const [date, count] of Object.entries(avail)) days[date] = count > 0;

  return NextResponse.json({ from, to, days });
}
