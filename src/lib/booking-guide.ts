// 予約確定時にゲストへ送る案内文。
// Web予約では自動送信し、手動予約では管理画面からコピーして送れるよう、
// 本文の組み立てだけをここに置く（送信手段に依存させない）。

// 館内の案内。変更はここだけ直せば全文に反映される。
export const WIFI_SSID = "nissei-guest";
export const WIFI_PASSWORD = "gh-nissei37";
export const HOUSE_NOTES = [
  "漁師町のため、夜間はお静かにお過ごしください。近隣の方は早朝から漁に出られます。",
  "館内は禁煙です。喫煙は屋外の灰皿をご利用ください。",
  "ゴミは分別のうえ、所定の場所にお願いいたします。",
];

export type BookingGuideInput = {
  guestName: string | null;
  code: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  checkInTime: string; // HH:MM
  checkOutTime: string; // HH:MM
  numGuests: number;
  planName: string | null;
  doorPin: string | null;
  registerUrl: string | null;
  lookupUrl: string | null; // 予約照会URL（鍵番号確認・キャンセルもここから）
  phone: string | null;
};

function jpDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日(${w})`;
}

export function bookingGuideSubject(guestName: string | null): string {
  const name = guestName?.trim();
  return name ? `【日靜】ご宿泊のご案内（${name}様）` : "【日靜】ご宿泊のご案内";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 本文をメール用のHTMLにする。URLはそのままだと押せないのでリンクにする。 */
export function bookingGuideHtml(input: BookingGuideInput): string {
  const body = escapeHtml(bookingGuideText(input))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0f766e">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;font-size:14px;line-height:1.9;color:#111827">${body}</div>`;
}

export function bookingGuideText(input: BookingGuideInput): string {
  const name = input.guestName?.trim();
  const blocks: string[] = [];

  blocks.push(
    `${name ? `${name} 様` : "お客様"}

このたびは一棟貸し宿「日靜」をご予約いただきありがとうございます。
ご宿泊にあたってのご案内をお送りします。`,
  );

  blocks.push(
    `■ ご予約内容
予約番号: ${input.code}
ご宿泊日: ${jpDate(input.checkIn)} 〜 ${jpDate(input.checkOut)}
人数: ${input.numGuests}名
プラン: ${input.planName ?? "—"}
チェックイン: ${input.checkInTime} 以降
チェックアウト: ${input.checkOutTime} まで${
      input.lookupUrl
        ? `

▼ 予約確認・ドアコード確認・キャンセルはこちら
${input.lookupUrl}
（予約番号とこのメールアドレスでログインできます）`
        : ""
    }`,
  );

  // 旅館業法で宿泊者名簿の作成が必要。ご宿泊前に全員ぶんお願いする。
  blocks.push(
    input.registerUrl
      ? `■ 宿泊者名簿のご記入（ご宿泊前にお願いします）
法令により、ご宿泊者全員の氏名・住所・連絡先などを宿泊者名簿に記録することが
定められております。お手数ですが、下記フォームよりご記入をお願いいたします。

${input.registerUrl}

ご同行の方がいらっしゃる場合は、人数分繰り返しご記入ください。
海外にお住まいの方は、国籍と旅券番号のご記入もお願いいたします。`
      : `■ 宿泊者名簿のご記入（ご宿泊前にお願いします）
法令により、ご宿泊者全員の氏名・住所・連絡先などを宿泊者名簿に記録することが
定められております。ご記入方法は別途ご案内いたします。`,
  );

  blocks.push(
    input.doorPin
      ? `■ 玄関の解錠方法
ドアコード: ${input.doorPin}

玄関ドアに付いているキーパッドに上記の番号を入力してください。
このコードは ${jpDate(input.checkIn)} ${input.checkInTime} から
${jpDate(input.checkOut)} ${input.checkOutTime} まで有効です。
他の方には共有なさらないようお願いいたします。`
      : `■ 玄関の解錠方法
ドアコードは前日のご案内メールでお知らせします。${input.lookupUrl ? `
予約照会ページ（${input.lookupUrl}）からもご確認いただけます。` : ""}`,
  );

  blocks.push(
    `■ Wi-Fi
ネットワーク名（SSID）: ${WIFI_SSID}
パスワード: ${WIFI_PASSWORD}`,
  );

  blocks.push(`■ お願い\n${HOUSE_NOTES.map((n) => `・${n}`).join("\n")}`);

  blocks.push(
    `■ お問い合わせ
ご不明な点やご到着が遅れる場合は、下記までご連絡ください。
${input.phone ? `電話: ${input.phone}` : ""}

当日お会いできますことを楽しみにしております。

――――――――――――――――
一棟貸し宿「日靜」
住所: 北海道広尾郡広尾町音調津733番地${input.phone ? `\n電話: ${input.phone}` : ""}`.replace(
      /\n\n+/g,
      "\n\n",
    ),
  );

  return blocks.join("\n\n");
}
