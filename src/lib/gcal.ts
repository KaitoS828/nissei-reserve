// Googleカレンダーへの予約反映。サービスアカウントで Calendar API を直接叩く。
// 以前は GAS Webアプリ経由だったが、デプロイと初回承認が必要で運用が止まりやすいため、
// smart-checkin-app-v2 で実績のあるサービスアカウント方式に寄せた。
// 未設定・失敗しても予約フローは止めない。

import { google } from "googleapis";

type CreatePayload = {
  code: string;
  customer?: string;
  email?: string;
  phone?: string;
  plan?: string;
  check_in: string;
  check_out: string;
  guests?: number;
  amount?: number;
};

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "primary";

function getCalendar() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // 環境変数に "\n" が文字列として入っている場合があるので実際の改行へ戻す
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

// 予約をカレンダーに作成し、作成された event_id を返す
export async function gcalCreateEvent(p: CreatePayload): Promise<string | null> {
  const calendar = getCalendar();
  if (!calendar) return null;

  try {
    // 終日イベントの end.date は排他的なので、チェックアウト日をそのまま渡せば
    // 宿泊期間と一致する。ただし同日以前になる場合だけ翌日に寄せる（0日イベントは作れない）。
    const end = p.check_out > p.check_in ? p.check_out : nextDay(p.check_in);

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `[nissei] 予約 ${p.code}${p.customer ? ` ${p.customer}` : ""}`,
        description: [
          `予約番号: ${p.code}`,
          p.plan ? `プラン: ${p.plan}` : null,
          p.guests ? `人数: ${p.guests}名` : null,
          p.amount ? `金額: ¥${p.amount.toLocaleString()}` : null,
          p.email ? `メール: ${p.email}` : null,
          p.phone ? `電話: ${p.phone}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        start: { date: p.check_in },
        end: { date: end },
      },
    });
    return event.data.id ?? null;
  } catch (e) {
    console.error("Googleカレンダーへの登録に失敗:", e);
    return null;
  }
}

// カレンダーの予約イベントを削除
export async function gcalDeleteEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  if (!calendar) return;
  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (e) {
    console.error("Googleカレンダーの削除に失敗:", e);
  }
}
