// 自社の予約を .ics として配信する。Airbnb 等に取り込ませて、
// 「自社で埋まっている日を他所で売られる」事故を防ぐのが目的。
//
// 取り込み（ical-import.ts）と対になる。日付の約束は逆向きなので注意:
//  - blocked_dates の end_date は「その日を含む」
//  - iCal の DTEND は「その日を含まない」
//  したがって書き出すときは end_date + 1 日を DTEND にする。

export type ExportStay = {
  uid: string;
  summary: string;
  start: string; // YYYY-MM-DD（この日から埋まる）
  endExclusive: string; // YYYY-MM-DD（この日は空いている）
};

function compact(date: string): string {
  return date.replace(/-/g, "");
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 予約（チェックアウト日は空く）をそのまま使える形にする。 */
export function stayFromReservation(r: {
  id: string;
  code: string;
  check_in: string;
  check_out: string;
}): ExportStay {
  return {
    uid: `resv-${r.id}@gh-nissei.jp`,
    // 相手先に個人情報を出さない。誰の予約かは自社の管理画面で見る。
    summary: "予約済み",
    start: r.check_in,
    endExclusive: r.check_out,
  };
}

/** 予約不可日（end_date はその日を含む）を DTEND の約束に合わせる。 */
export function stayFromBlocked(b: {
  id: string;
  start_date: string;
  end_date: string;
}): ExportStay {
  return {
    uid: `blocked-${b.id}@gh-nissei.jp`,
    summary: "予約不可",
    start: b.start_date,
    endExclusive: addDays(b.end_date, 1),
  };
}

// 75オクテットを超える行は折り返すのが iCal の作法。
// 日本語を含むので、バイト数ではなく安全側に短めで折る。
function fold(line: string): string {
  if (line.length <= 70) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 70));
  rest = rest.slice(70);
  while (rest.length > 69) {
    parts.push(` ${rest.slice(0, 69)}`);
    rest = rest.slice(69);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export function buildIcs(stays: ExportStay[], now = new Date()): string {
  const stamp = `${now.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nissei//reservation//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const s of stays) {
    if (!s.start || s.endExclusive <= s.start) continue;
    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${s.uid}`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(s.start)}`,
      `DTEND;VALUE=DATE:${compact(s.endExclusive)}`,
      fold(`SUMMARY:${s.summary}`),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
