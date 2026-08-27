import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, type GroqHistory } from "@/lib/groq-agent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // このエンドポイントは予約のキャンセルや返金まで実行できるため、管理者のみに限定する。
  // middleware の matcher は /admin/:path* のみで /api は対象外なので、ここで明示的に検証する。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
  }
  const history = Array.isArray(body.history) ? (body.history as GroqHistory) : [];

  try {
    const { reply, history: nextHistory } = await runAssistant(message, history);
    return NextResponse.json({ reply, history: nextHistory });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
