import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { toolImpls } from "@/lib/slack-agent";
import { getReservationByCode } from "@/lib/api-reservations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const { code } = await params;
  const reservation = await getReservationByCode(code);
  if (!reservation) return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  return NextResponse.json({ reservation });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const { code } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSONボディが不正です" }, { status: 400 });

  const message = await toolImpls.update_reservation({ code, ...body });
  if (message.includes("見つかりません") || message.includes("空きがない") || message.includes("翌日以降")) {
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const reservation = await getReservationByCode(code);
  return NextResponse.json({ message, reservation });
}
