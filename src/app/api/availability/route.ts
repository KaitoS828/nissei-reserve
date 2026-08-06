import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTypeAvailability } from "@/lib/reservations";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

// 公開: 指定 room_type の [from,to) 各泊の空き室数を返す
// roomType 省略時は最初の有効な客室タイプを使う（1施設運用想定）
export async function GET(req: NextRequest) {
  // カレンダーは月送りのたびに叩くため、上限は緩めに取る
  const limited = rateLimit(`availability:${ipFromRequest(req)}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてからお試しください" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  let roomType = searchParams.get("roomType");

  if (!from || !to) {
    return NextResponse.json({ error: "from/to は必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!roomType) {
    const { data } = await supabase
      .from("room_types")
      .select("id")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    roomType = data?.id ?? null;
  }
  if (!roomType) return NextResponse.json({ availability: {} });

  const availability = await getTypeAvailability(roomType, from, to);
  return NextResponse.json({ availability });
}
