// チェックアウト後のゲストへ送るGoogleレビュー（クチコミ）依頼メール。
// 管理画面からの手動送信や、チェックアウト後の送信で使用。

export const DEFAULT_GOOGLE_REVIEW_URL = "https://g.page/r/Ce-mx4FEUkKbEAE/review";

export type ReviewRequestInput = {
  guestName: string | null;
  code: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  reviewUrl?: string | null;
  phone?: string | null;
};

function jpDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日(${w})`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function reviewRequestSubject(_guestName?: string | null): string {
  return "【一棟貸し宿 日靜】ご宿泊の御礼とご感想（口コミ）のお願い";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 本文をメール用のHTMLにする。 */
export function reviewRequestHtml(input: ReviewRequestInput): string {
  const reviewUrl = input.reviewUrl || process.env.GOOGLE_REVIEW_URL || DEFAULT_GOOGLE_REVIEW_URL;
  const name = input.guestName?.trim();
  const phone = input.phone?.trim();

  return `
  <div style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;font-size:14px;line-height:1.9;color:#1f2937;max-width:560px;margin:0 auto">
    <div style="border-bottom:2px solid #0d9488;padding:16px 0">
      <strong style="font-size:18px;color:#0f766e">一棟貸し宿「日靜」</strong>
    </div>

    <div style="padding:24px 0">
      <p style="margin:0 0 16px;font-weight:600">${escapeHtml(name ? `${name} 様` : "お客様")}</p>

      <p style="margin:0 0 16px">
        このたびは一棟貸し宿「日靜」にご宿泊いただき、誠にありがとうございました。<br>
        また、お部屋を大変綺麗にご利用いただき心より感謝申し上げます。
      </p>

      <p style="margin:0 0 16px">
        当宿でのご滞在は心地よくお過ごしいただけましたでしょうか。<br>
        広尾町・音調津の静かなひとときが、皆様にとって少しでも癒やしや思い出の時間となっておりましたら幸いでございます。
      </p>

      <div style="margin:24px 0;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
        <p style="margin:0 0 12px;font-weight:600;color:#166534;font-size:15px">
          📝 Googleクチコミ（ご感想）のお願い
        </p>
        <p style="margin:0 0 16px;font-size:13px;color:#374151">
          日靜はより心地よい宿づくりを目指しております。もしよろしければ、実際にご宿泊いただいたご感想や旅のエピソードをGoogleのクチコミにてお聞かせいただけますと大変励みになります。（1分ほどでご投稿いただけます）
        </p>
        <div style="text-align:center;margin:16px 0">
          <a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
            Googleクチコミを投稿する
          </a>
        </div>
        <p style="margin:12px 0 0;font-size:12px;color:#6b7280;text-align:center">
          ※ご投稿にはGoogleアカウントへのログインが必要となります。<br>
          リンクが開かない場合はこちら：<br>
          <a href="${escapeHtml(reviewUrl)}" style="color:#0f766e;word-break:break-all">${escapeHtml(reviewUrl)}</a>
        </p>
      </div>

      <table style="margin:16px 0;font-size:13px;color:#4b5563;border-collapse:collapse">
        <tr>
          <td style="padding:4px 12px 4px 0;color:#9ca3af">予約番号</td>
          <td style="padding:4px 0;font-weight:600">${escapeHtml(input.code)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;color:#9ca3af">ご宿泊日程</td>
          <td style="padding:4px 0">${escapeHtml(jpDate(input.checkIn))} 〜 ${escapeHtml(jpDate(input.checkOut))}</td>
        </tr>
      </table>

      <p style="margin:20px 0 0">
        また北海道・十勝方面へお越しの際は、ぜひお立ち寄りいただけますと幸いです。<br>
        皆様のまたのお越しを心よりお待ちしております。
      </p>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding:16px 0;color:#6b7280;font-size:12px;line-height:1.6">
      <strong style="color:#374151">一棟貸し宿「日靜」</strong><br>
      住所: 北海道広尾郡広尾町音調津733番地<br>
      ${phone ? `電話: ${escapeHtml(phone)}<br>` : ""}
      メール: info@gh-nissei.jp
    </div>
  </div>`;
}

/** メール作成・プレビュー・コピー用のプレーンテキスト本文を組む */
export function reviewRequestText(input: ReviewRequestInput): string {
  const reviewUrl = input.reviewUrl || process.env.GOOGLE_REVIEW_URL || DEFAULT_GOOGLE_REVIEW_URL;
  const name = input.guestName?.trim();
  const phone = input.phone?.trim();

  const blocks: string[] = [];

  blocks.push(
    `${name ? `${name} 様` : "お客様"}

このたびは一棟貸し宿「日靜」にご宿泊いただき、誠にありがとうございました。
また、お部屋を大変綺麗にご利用いただき心より感謝申し上げます。

当宿でのご滞在は心地よくお過ごしいただけましたでしょうか。
広尾町・音調津の静かなひとときが、皆様にとって少しでも癒やしや思い出の時間となっておりましたら幸いでございます。`,
  );

  blocks.push(
    `■ Googleクチコミ（ご感想）のお願い
日靜では、皆様のご意見を大切にし、より心地よい宿づくりを目指しております。
もしよろしければ、実際にご滞在されたご感想や旅のエピソードをGoogleのクチコミにてお聞かせいただけますと大変励みになります。
（1分ほどで簡単にご投稿いただけます）

▼ Googleクチコミの投稿はこちら（※Googleへのログインが必要です）
${reviewUrl}`,
  );

  blocks.push(
    `■ ご宿泊内容
予約番号: ${input.code}
ご宿泊日程: ${jpDate(input.checkIn)} 〜 ${jpDate(input.checkOut)}`,
  );

  blocks.push(
    `また北海道・十勝方面へお越しの機会がございましたら、ぜひお立ち寄りください。
皆様のまたのお越しを心よりお待ちしております。

――――――――――――――――
一棟貸し宿「日靜」
住所: 北海道広尾郡広尾町音調津733番地
${phone ? `電話: ${phone}\n` : ""}メール: info@gh-nissei.jp`.replace(/\n\n+/g, "\n\n"),
  );

  return blocks.join("\n\n");
}

/** 編集されたプレーンテキスト本文をHTMLメール用にフォーマットする */
export function reviewRequestCustomHtml(customBody: string): string {
  const body = escapeHtml(customBody.trim())
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#0f766e;text-decoration:underline">$1</a>')
    .replace(/\n/g, "<br>");

  return `
  <div style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;font-size:14px;line-height:1.9;color:#1f2937;max-width:560px;margin:0 auto">
    <div style="border-bottom:2px solid #0d9488;padding:16px 0">
      <strong style="font-size:18px;color:#0f766e">一棟貸し宿「日靜」</strong>
    </div>

    <div style="padding:24px 0">
      ${body}
    </div>

    <div style="border-top:1px solid #e5e7eb;padding:16px 0;color:#6b7280;font-size:12px;line-height:1.6">
      <strong style="color:#374151">一棟貸し宿「日靜」</strong><br>
      住所: 北海道広尾郡広尾町音調津733番地<br>
      メール: info@gh-nissei.jp
    </div>
  </div>`;
}
