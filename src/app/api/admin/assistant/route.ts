import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, type GroqHistory } from "@/lib/groq-agent";
import { loadSession, saveSession } from "@/lib/assistant-session";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  // このエンドポイントは予約のキャンセルや返金まで実行できるため、管理者のみに限定する。
  // middleware の matcher は /admin/:path* のみで /api は対象外なので、ここで明示的に検証する。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && user.app_metadata?.role === "admin" ? user : null;
}

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

// 画面を開き直したときに会話を復元するため、保存済みの発言（ユーザー/アシスタントのテキストのみ）を返す。
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  if (!SESSION_ID.test(sessionId)) return NextResponse.json({ messages: [] });

  const history = await loadSession<GroqHistory[number]>(`admin:${user.id}:${sessionId}`);
  const messages = history.flatMap((m) =>
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content
      ? [{ role: m.role, text: m.content }]
      : [],
  );
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  let body: { message?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: "セッションIDが不正です" }, { status: 400 });
  }
  const sessionKey = `admin:${user.id}:${sessionId}`;

  try {
    const history = await loadSession<GroqHistory[number]>(sessionKey);
    const { reply, history: nextHistory } = await runAssistant(message, history);
    await saveSession(sessionKey, "admin", nextHistory);
    return NextResponse.json({ reply });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
