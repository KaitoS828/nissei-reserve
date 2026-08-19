// チェックイン前日のリマインド。
// 案内メールは予約時に一度送るだけなので、宿泊が近づいた頃には埋もれている。
// 名簿が未記入のまま当日を迎えるのも困るため、前日にもう一度お知らせする。

export type ReminderInput = {
  guestName: string | null;
  code: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  checkInTime: string; // HH:MM
  numGuests: number;
  registeredGuests: number;
  doorPin: string | null;
  registerUrl: string | null;
  lookupUrl: string | null; // 予約照会URL
  phone: string | null;
};

function jpDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日(${w})`;
}

export function reminderSubject(guestName: string | null): string {
  const name = guestName?.trim();
  return name ? `【日靜】明日のご宿泊について（${name}様）` : "【日靜】明日のご宿泊について";
}

export function reminderText(input: ReminderInput): string {
  const name = input.guestName?.trim();
  const missing = Math.max(0, input.numGuests - input.registeredGuests);
  const blocks: string[] = [];

  blocks.push(
    `${name ? `${name} 様` : "お客様"}

明日 ${jpDate(input.checkIn)} のご宿泊を承っております。
当日のご案内を改めてお送りします。`,
  );

  blocks.push(
    `■ ご予約内容
予約番号: ${input.code}
ご宿泊日: ${jpDate(input.checkIn)} 〜 ${jpDate(input.checkOut)}
人数: ${input.numGuests}名
チェックイン: ${input.checkInTime} 以降`,
  );

  blocks.push(
    input.doorPin
      ? `■ 玄関の解錠方法
ドアコード: ${input.doorPin}

玄関ドアに付いているキーパッドに上記の番号を入力してください。
他の方には共有なさらないようお願いいたします。`
      : `■ 玄関の解錠方法
ドアコードは本日中にご連絡いたします。${input.lookupUrl ? `または下記の予約照会ページでもご確認いただけます。
${input.lookupUrl}` : ""}`,
  );

  // 揃っているのに催促すると失礼になるので、足りないときだけ出す
  if (missing > 0 && input.registerUrl) {
    blocks.push(
      `■ 宿泊者名簿のご記入をお願いいたします
法令により、ご宿泊者全員の記録が必要です。
現在 ${input.registeredGuests} / ${input.numGuests} 名分のご記入をいただいております。
恐れ入りますが、残り${missing}名分のご記入をお願いいたします。

${input.registerUrl}`,
    );
  }

  blocks.push(
    `■ お問い合わせ
ご到着が遅れる場合や、ご不明な点がございましたらご連絡ください。
${input.phone ? `電話: ${input.phone}` : ""}

お会いできますことを楽しみにしております。

――――――――――――――――
一棟貸し宿「日靜」
住所: 北海道広尾郡広尾町音調津733番地${input.phone ? `\n電話: ${input.phone}` : ""}`.replace(
      /\n\n+/g,
      "\n\n",
    ),
  );

  return blocks.join("\n\n");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function reminderHtml(input: ReminderInput): string {
  const body = escapeHtml(reminderText(input))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0f766e">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;font-size:14px;line-height:1.9;color:#111827">${body}</div>`;
}

/** JST の「明日」。cron は UTC で動くので、日本時間で判断する。 */
export function tomorrowJst(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  jst.setUTCDate(jst.getUTCDate() + 1);
  return jst.toISOString().slice(0, 10);
}
