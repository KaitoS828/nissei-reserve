// 内部AIチャットの会話ログをDBに保存する。Slack(Anthropic形式)と管理画面(Groq形式)の
// どちらのメッセージ配列もそのまま jsonb で持つ。

import { createAdminClient } from "./supabase/admin";

const MAX_MESSAGES = 40;

type AnyMessage = { role: string; content?: unknown; tool_calls?: unknown };

// 履歴の先頭が tool_result / tool 応答だと API が拒否するので、通常のユーザー発言から始まるよう切り詰める。
function trim<T extends AnyMessage>(messages: T[]): T[] {
  const tail = messages.slice(-MAX_MESSAGES);
  const start = tail.findIndex((m) => m.role === "user" && typeof m.content === "string");
  return start === -1 ? [] : tail.slice(start);
}

export async function loadSession<T extends AnyMessage>(key: string): Promise<T[]> {
  const { data, error } = await createAdminClient()
    .from("assistant_sessions")
    .select("messages")
    .eq("session_key", key)
    .maybeSingle();
  if (error) {
    console.error("assistant_sessions の読み込みに失敗（migration 0021 未適用？）:", error.message);
    return [];
  }
  return (data?.messages as T[] | undefined) ?? [];
}

export async function saveSession<T extends AnyMessage>(key: string, channel: "slack" | "admin", messages: T[]): Promise<void> {
  const { error } = await createAdminClient()
    .from("assistant_sessions")
    .upsert({ session_key: key, channel, messages: trim(messages), updated_at: new Date().toISOString() });
  if (error) console.error("assistant_sessions の保存に失敗（migration 0021 未適用？）:", error.message);
}
