import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { WebClient } from "@slack/web-api";
import { runAgent } from "@/lib/slack-agent";

// 本番(Vercel)用 Slack Event Subscriptions エンドポイント。
// ローカルでは Socket Mode（scripts/slack-agent.ts）を使う。

function verify(rawBody: string, ts: string | null, sig: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !ts || !sig) return false;
  // 5分以上前のリクエストは拒否
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
  const base = `v0:${ts}:${rawBody}`;
  const hmac = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");

  const body = JSON.parse(raw);

  // URL検証（初回登録時）
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (!verify(raw, ts, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // リトライは無視（二重処理防止）
  if (req.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;
  if (event && event.type === "app_mention") {
    // メンション部分を除いたテキスト
    const text = String(event.text ?? "").replace(/<@[^>]+>/g, "").trim();
    const channel = event.channel;
    const thread = event.thread_ts ?? event.ts;

    // 3秒以内に200を返し、処理はバックグラウンドで
    waitUntil(
      (async () => {
        const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
        try {
          const reply = await runAgent(text);
          await slack.chat.postMessage({ channel, thread_ts: thread, text: reply });
        } catch (e) {
          await slack.chat.postMessage({ channel, thread_ts: thread, text: `エラー: ${e instanceof Error ? e.message : String(e)}` });
        }
      })(),
    );
  }

  return NextResponse.json({ ok: true });
}
