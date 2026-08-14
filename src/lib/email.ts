// Resend でメール送信（パッケージ不要、REST API を fetch）
// 未設定・失敗しても予約フローを止めないよう、呼び出し側で握りつぶす。

import { dict, type Locale } from "@/lib/i18n";

type SendArgs = { to: string | string[]; subject: string; html: string };

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  // 送信ドメインに MX が無いと、お客様が返信してもどこにも届かない。
  // 実際に読めるアドレスを Reply-To に入れておく。
  const replyTo =
    process.env.EMAIL_REPLY_TO?.trim() ||
    (process.env.OWNER_EMAILS || "").split(",")[0]?.trim() ||
    "";
  if (!key) return false;
  const recipients = (Array.isArray(to) ? to : [to]).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return false;

  // 宛先ごとに個別送信。1件が拒否されても他には届く（Resendテストモード等への耐性）。
  const results = await Promise.all(
    recipients.map(async (addr) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `一棟貸し宿「日靜」 <${from}>`,
            to: addr,
            subject,
            html,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }),
  );
  return results.some(Boolean);
}

// オーナー通知の宛先（カンマ区切り）
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// HTMLエスケープ（顧客名・自由記述などのユーザー入力をメールHTMLに安全に埋め込む）
function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// オーナー宛は日本語固定なので既定は ja。お客様宛だけ locale を渡す。
const wrap = (inner: string, locale: Locale = "ja") => {
  const t = dict(locale).email;
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <div style="border-bottom:2px solid #0d9488;padding:16px 0">
      <strong style="font-size:18px">${t.brand}</strong>
    </div>
    <div style="padding:20px 0">${inner}</div>
    <div style="border-top:1px solid #e5e7eb;padding:12px 0;color:#9ca3af;font-size:12px">
      ${t.footer}
    </div>
  </div>`;
};

const row = (k: string, v: string) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${k}</td><td style="padding:4px 0;font-weight:600">${v}</td></tr>`;

export function bookingConfirmedHtml(p: {
  name: string; code: string; plan: string; checkIn: string; checkOut: string; nights: number; guests: number; amount: number; checkinUrl?: string;
}): string {
  return wrap(`
    <p>${esc(p.name)} 様</p>
    <p>ご予約ありがとうございます。下記の内容で予約が確定しました。</p>
    <table style="margin:12px 0;font-size:14px">
      ${row("予約番号", esc(p.code))}
      ${row("プラン", esc(p.plan))}
      ${row("日程", `${esc(p.checkIn)} 〜 ${esc(p.checkOut)}（${p.nights}泊）`)}
      ${row("人数", `${p.guests}名`)}
      ${row("お支払い金額", `¥${p.amount.toLocaleString()}`)}
    </table>
    <p>当日のご来館を心よりお待ちしております。</p>
    <div style="margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px">
      <p style="margin:0 0 6px"><strong>📌 予約番号は必ず保存してください。</strong>確認・変更・キャンセルに必要です。</p>
      <p style="margin:0 0 6px">🔑 会員（マイページ）の方は、マイページからいつでも確認・<strong>キャンセル</strong>が可能です。</p>
      ${p.checkinUrl ? `<p style="margin:0 0 6px">🚪 玄関の<strong>ドアコード</strong>は <a href="${esc(p.checkinUrl)}" style="color:#0f766e">チェックインページ</a> でご確認いただけます（予約番号とこのメールアドレスが必要です）。</p>` : ""}
      <p style="margin:0">📞 ご不明点は <strong>070-1251-6275</strong> までお問い合わせください。</p>
    </div>`);
}

// オーナー宛（新規予約）
export function ownerBookingHtml(p: {
  name: string; code: string; plan: string; checkIn: string; checkOut: string; nights: number; guests: number; amount: number; email?: string; phone?: string;
}): string {
  return wrap(`
    <p><strong>🆕 新規予約が入りました</strong></p>
    <table style="margin:12px 0;font-size:14px">
      ${row("予約番号", esc(p.code))}
      ${row("お客様", `${esc(p.name)} 様（${p.guests}名）`)}
      ${row("連絡先", `${esc(p.email ?? "—")} / ${esc(p.phone ?? "—")}`)}
      ${row("プラン", esc(p.plan))}
      ${row("日程", `${esc(p.checkIn)} 〜 ${esc(p.checkOut)}（${p.nights}泊）`)}
      ${row("金額", `¥${p.amount.toLocaleString()}`)}
    </table>`);
}

// オーナー宛（キャンセル）
export function ownerCancellationHtml(p: {
  name: string; code: string; category: string; reason: string; refund: number;
}): string {
  return wrap(`
    <p><strong>❌ 予約がキャンセルされました</strong></p>
    <table style="margin:12px 0;font-size:14px">
      ${row("予約番号", esc(p.code))}
      ${row("お客様", `${esc(p.name)} 様`)}
      ${row("理由", `${esc(p.category)}${p.reason ? ` / ${esc(p.reason)}` : ""}`)}
      ${row("返金額", `¥${p.refund.toLocaleString()}`)}
    </table>`);
}

export function cancellationHtml(p: {
  name: string; code: string; refund: number; locale?: Locale;
}): string {
  const locale = p.locale ?? "ja";
  const t = dict(locale).email;
  return wrap(`
    <p>${esc(t.honorific(p.name))}</p>
    <p>${esc(t.cancelLead(p.code))}</p>
    <table style="margin:12px 0;font-size:14px">
      ${row(t.refundLabel, `¥${p.refund.toLocaleString()}`)}
    </table>
    <p>${t.cancelClosing}</p>`, locale);
}

/** キャンセル受付メールの件名。 */
export function cancellationSubject(code: string, locale: Locale = "ja"): string {
  return dict(locale).email.cancelSubject(code);
}
