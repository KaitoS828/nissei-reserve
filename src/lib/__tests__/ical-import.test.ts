import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockedRangeFromEvent, icalMarker, parseIcal } from "../ical-import";

const ics = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", body, "END:VCALENDAR"].join("\r\n");

const vevent = (lines: string[]) =>
  ics(["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n"));

describe("parseIcal", () => {
  it("終日予定を取り出す", () => {
    const events = parseIcal(
      vevent([
        "UID:abc123@airbnb.com",
        "DTSTART;VALUE=DATE:20260801",
        "DTEND;VALUE=DATE:20260803",
        "SUMMARY:Reserved",
      ]),
    );
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      uid: "abc123@airbnb.com",
      start: "2026-08-01",
      end: "2026-08-03",
      summary: "Reserved",
    });
  });

  it("複数の予定を取り出す", () => {
    const text = ics(
      [
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20260801",
        "DTEND;VALUE=DATE:20260803",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20260910",
        "DTEND;VALUE=DATE:20260912",
        "END:VEVENT",
      ].join("\r\n"),
    );
    assert.equal(parseIcal(text).length, 2);
  });

  it("75桁で折り返された行を元に戻す", () => {
    // 継続行は CRLF + 空白。戻さないと SUMMARY が途中で切れる
    const events = parseIcal(
      vevent(["DTSTART;VALUE=DATE:20260801", "DTEND;VALUE=DATE:20260802", "SUMMARY:Reserved -\r\n  Airbnb"]),
    );
    assert.equal(events[0].summary, "Reserved - Airbnb");
  });

  it("DTEND が無ければ1泊として扱う", () => {
    const events = parseIcal(vevent(["DTSTART;VALUE=DATE:20260801", "SUMMARY:x"]));
    assert.equal(events[0].end, "2026-08-02");
  });

  it("時刻付き・TZID付きでも日付を取り出せる", () => {
    const events = parseIcal(
      vevent([
        "DTSTART;TZID=Asia/Tokyo:20260801T150000",
        "DTEND;TZID=Asia/Tokyo:20260801T170000",
        "SUMMARY:清掃",
      ]),
    );
    assert.equal(events[0].start, "2026-08-01");
    assert.equal(events[0].end, "2026-08-01");
  });

  it("DTSTAMP を DTSTART と取り違えない", () => {
    const events = parseIcal(
      vevent(["DTSTAMP:20260101T000000Z", "DTSTART;VALUE=DATE:20260801", "DTEND;VALUE=DATE:20260802"]),
    );
    assert.equal(events[0].start, "2026-08-01");
  });

  it("SUMMARY が無ければ既定の名前を入れる", () => {
    const events = parseIcal(vevent(["DTSTART;VALUE=DATE:20260801", "DTEND;VALUE=DATE:20260802"]));
    assert.equal(events[0].summary, "外部カレンダー");
  });

  it("UID が無くても日付と概要から作る", () => {
    const events = parseIcal(
      vevent(["DTSTART;VALUE=DATE:20260801", "DTEND;VALUE=DATE:20260802", "SUMMARY:Reserved"]),
    );
    assert.equal(events[0].uid, "2026-08-01-Reserved");
  });

  it("DTSTART が無い予定は捨てる", () => {
    assert.deepEqual(parseIcal(vevent(["SUMMARY:壊れた予定"])), []);
  });

  it("予定が無ければ空", () => {
    assert.deepEqual(parseIcal(ics("X-WR-CALNAME:Empty")), []);
    assert.deepEqual(parseIcal(""), []);
  });
});

describe("blockedRangeFromEvent", () => {
  const ev = (start: string, end: string) => ({ uid: "u", summary: "s", start, end });

  it("DTEND は終了日を含まないので1日戻す（在庫を余計に潰さない）", () => {
    // 8/1 IN → 8/3 OUT は 8/1・8/2 の2泊。8/3 は空いている
    assert.deepEqual(blockedRangeFromEvent(ev("2026-08-01", "2026-08-03")), {
      start_date: "2026-08-01",
      end_date: "2026-08-02",
    });
  });

  it("1泊の予定は同日で閉じる", () => {
    assert.deepEqual(blockedRangeFromEvent(ev("2026-08-01", "2026-08-02")), {
      start_date: "2026-08-01",
      end_date: "2026-08-01",
    });
  });

  it("同日で終わる予定（時刻付き）は戻さない", () => {
    assert.deepEqual(blockedRangeFromEvent(ev("2026-08-01", "2026-08-01")), {
      start_date: "2026-08-01",
      end_date: "2026-08-01",
    });
  });

  it("月をまたぐ予定でも正しく戻す", () => {
    assert.deepEqual(blockedRangeFromEvent(ev("2026-08-31", "2026-09-02")), {
      start_date: "2026-08-31",
      end_date: "2026-09-01",
    });
  });

  it("年をまたぐ予定でも正しく戻す", () => {
    assert.deepEqual(blockedRangeFromEvent(ev("2026-12-30", "2027-01-02")), {
      start_date: "2026-12-30",
      end_date: "2027-01-01",
    });
  });

  it("うるう日をまたぐ予定でも正しく戻す", () => {
    assert.deepEqual(blockedRangeFromEvent(ev("2028-02-27", "2028-03-01")), {
      start_date: "2028-02-27",
      end_date: "2028-02-29",
    });
  });

  it("開始日が無ければ null", () => {
    assert.equal(blockedRangeFromEvent(ev("", "2026-08-02")), null);
  });
});

describe("icalMarker", () => {
  it("ソースIDを含む目印を作る（名称変更に影響されない）", () => {
    const id = "3f1c0f2e-0000-4000-8000-000000000001";
    assert.equal(icalMarker(id), `[ical:${id}]`);
    assert.ok(icalMarker(id).startsWith("[ical:"));
  });
});

describe("取り込み全体の日付整合", () => {
  it("Airbnb 形式の予約が正しい泊数ぶんだけブロックされる", () => {
    const events = parseIcal(
      vevent([
        "UID:reservation-1@airbnb.com",
        "DTSTART;VALUE=DATE:20260814",
        "DTEND;VALUE=DATE:20260817",
        "SUMMARY:Reserved",
      ]),
    );
    const range = blockedRangeFromEvent(events[0]);
    // 8/14・8/15・8/16 の3泊。8/17 は次の客を受けられる
    assert.deepEqual(range, { start_date: "2026-08-14", end_date: "2026-08-16" });
  });
});
