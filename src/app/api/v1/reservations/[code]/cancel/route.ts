import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { toolImpls } from "@/lib/slack-agent";
import { getReservationByCode } from "@/lib/api-reservations";

// クエリ ?quote=1 で試算のみ（DBは変更しない）
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const limited = rateLimit(`v1-cancel:${req.headers.get("authorization")}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "リクエストが多すぎます" }, { status: 429 });
  }

  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const quoteOnly = searchParams.get("quote") === "1";
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  if (quoteOnly) {
    const message = await toolImpls.quote_cancellation({ code });
    if (message.includes("見つかりません")) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ message });
  }

  const message = await toolImpls.cancel_reservation({ code, reason: (body as { reason?: string }).reason ?? "" });
  if (message.includes("見つかりません")) return NextResponse.json({ error: message }, { status: 404 });
  if (message.includes("失敗")) return NextResponse.json({ error: message }, { status: 502 });

  const reservation = await getReservationByCode(code);
  return NextResponse.json({ message, reservation });
}
