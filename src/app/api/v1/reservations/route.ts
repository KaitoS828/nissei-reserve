import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { toolImpls } from "@/lib/slack-agent";
import { listReservations, getReservationByCode } from "@/lib/api-reservations";

export async function GET(req: NextRequest) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") as "today" | "upcoming" | "all" | null;
  const query = searchParams.get("query");

  const reservations = await listReservations({ scope: scope ?? undefined, query });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const limited = rateLimit(`v1-reservations-write:${req.headers.get("authorization")}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "リクエストが多すぎます" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSONボディが不正です" }, { status: 400 });

  const message = await toolImpls.create_reservation(body as Record<string, unknown>);
  if (!message.startsWith("✅")) {
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const m = /予約番号[:：]\s*(\S+)/.exec(message);
  const code = m?.[1];
  const reservation = code ? await getReservationByCode(code) : null;
  return NextResponse.json({ message, reservation }, { status: 201 });
}
