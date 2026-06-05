// オーナー向け運用通知（Discord / Slack の Incoming Webhook）
// DISCORD_WEBHOOK_URL か SLACK_WEBHOOK_URL のうち設定されている方へ送る。
// 未設定・失敗しても予約フローを止めない。

export async function notifyOwner(text: string): Promise<boolean> {
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const slack = process.env.SLACK_WEBHOOK_URL;

  try {
    if (discord) {
      const res = await fetch(discord, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      return res.ok;
    }
    if (slack) {
      const res = await fetch(slack, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return false;
}

export function newBookingMessage(p: {
  code: string; name: string; plan: string; checkIn: string; checkOut: string; nights: number; guests: number; amount: number;
}): string {
  return [
    "🆕 **新規予約が入りました**",
    `予約番号: ${p.code}`,
    `お客様: ${p.name} 様（${p.guests}名）`,
    `プラン: ${p.plan}`,
    `日程: ${p.checkIn} 〜 ${p.checkOut}（${p.nights}泊）`,
    `金額: ¥${p.amount.toLocaleString()}`,
  ].join("\n");
}

export function cancellationMessage(p: {
  code: string; name: string; category: string; reason: string; refund: number;
}): string {
  return [
    "❌ **予約がキャンセルされました**",
    `予約番号: ${p.code}`,
    `お客様: ${p.name} 様`,
    `理由: ${p.category}${p.reason ? ` / ${p.reason}` : ""}`,
    `返金額: ¥${p.refund.toLocaleString()}`,
  ].join("\n");
}
