/**
 * ローカル開発用 Slack エージェント（Socket Mode）
 * 公開URL不要。`npx tsx scripts/slack-agent.ts` で起動。
 *
 * 必要な環境変数（.env.local）:
 *   ANTHROPIC_API_KEY  : Claude APIキー
 *   SLACK_BOT_TOKEN    : xoxb-...（OAuth & Permissions のBot User OAuth Token）
 *   SLACK_APP_TOKEN    : xapp-...（Basic Information のApp-Level Token, scope: connections:write）
 *   （Supabase/Stripe等は既存のまま）
 *
 * Slack側の事前設定:
 *   - Socket Mode を有効化
 *   - Event Subscriptions で Bot Events に app_mention を追加
 *   - スコープ: app_mentions:read, chat:write
 *   - ボットをチャンネルに招待（/invite @日靜通知bot）
 */
process.loadEnvFile(".env.local");

import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { runAgent } from "../src/lib/slack-agent";

const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;

if (!appToken || !botToken) {
  console.error("SLACK_APP_TOKEN と SLACK_BOT_TOKEN を .env.local に設定してください。");
  process.exit(1);
}

const web = new WebClient(botToken);
const socket = new SocketModeClient({ appToken });

// スレッドごとの会話履歴（確認ステップの文脈保持用）。プロセスが生きている間だけ保持。
type History = Awaited<ReturnType<typeof runAgent>>["messages"];
const threadHistory = new Map<string, History>();

socket.on("app_mention", async ({ event, ack }: { event: { text?: string; channel: string; ts: string; thread_ts?: string }; ack: () => Promise<void> }) => {
  await ack();
  const text = String(event.text ?? "").replace(/<@[^>]+>/g, "").trim();
  const threadKey = event.thread_ts ?? event.ts;
  console.log("[mention]", text);
  try {
    const history = threadHistory.get(threadKey) ?? [];
    const { reply, messages } = await runAgent(text, history);
    threadHistory.set(threadKey, messages.slice(-24));
    await web.chat.postMessage({ channel: event.channel, thread_ts: threadKey, text: reply });
  } catch (e) {
    await web.chat.postMessage({ channel: event.channel, thread_ts: threadKey, text: `エラー: ${e instanceof Error ? e.message : String(e)}` });
  }
});

socket.start().then(() => {
  console.log("✅ Slackエージェント起動（Socket Mode）。チャンネルで @日靜通知bot にメンションしてください。");
});
