import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, buildIcs, stayFromBlocked, stayFromReservation } from "../ical-export";

const NOW = new Date("2026-08-12T03:00:00Z");

describe("stayFromReservation", () => {
  it("チェックアウト日は埋めない（DTEND は含まない日）", () => {
    const s = stayFromReservation({
      id: "r1",
      code: "R-20260814-KFKZ",
      check_in: "2026-08-14",
      check_out: "2026-08-17",
    });
    // 8/14・15・16 の3泊。8/17 は次の客を受けられる
    assert.equal(s.start, "2026-08-14");
    assert.equal(s.endExclusive, "2026-08-17");
  });

  it("相手先に個人情報を出さない", () => {
    const s = stayFromReservation({ id: "r1", code: "R-1", check_in: "2026-08-14", check_out: "2026-08-15" });
    assert.equal(s.summary, "予約済み");
    assert.ok(!s.summary.includes("R-1"));
  });
});

describe("stayFromBlocked", () => {
  it("end_date はその日を含むので、DTEND は翌日にする", () => {
    // 8/14〜8/16 を塞ぐ＝3泊ぶん。DTEND は 8/17
    const s = stayFromBlocked({ id: "b1", start_date: "2026-08-14", end_date: "2026-08-16" });
    assert.equal(s.start, "2026-08-14");
    assert.equal(s.endExclusive, "2026-08-17");
  });

  it("1日だけの休業でも1泊ぶんになる", () => {
    const s = stayFromBlocked({ id: "b1", start_date: "2026-08-14", end_date: "2026-08-14" });
    assert.equal(s.endExclusive, "2026-08-15");
  });

  it("月・年・うるう日をまたいでもずれない", () => {
    assert.equal(stayFromBlocked({ id: "b", start_date: "2026-08-30", end_date: "2026-08-31" }).endExclusive, "2026-09-01");
    assert.equal(stayFromBlocked({ id: "b", start_date: "2026-12-30", end_date: "2026-12-31" }).endExclusive, "2027-01-01");
    assert.equal(stayFromBlocked({ id: "b", start_date: "2028-02-27", end_date: "2028-02-29" }).endExclusive, "2028-03-01");
  });
});

describe("addDays", () => {
  it("月末・年末・うるう日をまたげる", () => {
    assert.equal(addDays("2026-08-31", 1), "2026-09-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2026-09-01", -1), "2026-08-31");
  });
});

describe("buildIcs", () => {
  const stays = [
    stayFromReservation({ id: "r1", code: "R-1", check_in: "2026-08-14", check_out: "2026-08-17" }),
    stayFromBlocked({ id: "b1", start_date: "2026-09-01", end_date: "2026-09-01" }),
  ];

  it("カレンダーの器を正しく作る", () => {
    const ics = buildIcs(stays, NOW);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR"));
    assert.ok(ics.includes("VERSION:2.0"));
  });

  it("行は CRLF で区切る", () => {
    assert.ok(buildIcs(stays, NOW).includes("\r\n"));
  });

  it("予定の数だけ VEVENT を作る", () => {
    const ics = buildIcs(stays, NOW);
    assert.equal(ics.split("BEGIN:VEVENT").length - 1, 2);
    assert.equal(ics.split("END:VEVENT").length - 1, 2);
  });

  it("日付は区切りなしの8桁で書く", () => {
    const ics = buildIcs(stays, NOW);
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20260814"));
    assert.ok(ics.includes("DTEND;VALUE=DATE:20260817"));
  });

  it("UID は予定ごとに変わる（取り込み側で同じ予定と分かる）", () => {
    const ics = buildIcs(stays, NOW);
    assert.ok(ics.includes("UID:resv-r1@gh-nissei.jp"));
    assert.ok(ics.includes("UID:blocked-b1@gh-nissei.jp"));
  });

  it("開始と終了が同じ、または逆転した予定は書かない", () => {
    const bad = [
      { uid: "a", summary: "x", start: "2026-08-14", endExclusive: "2026-08-14" },
      { uid: "b", summary: "x", start: "2026-08-14", endExclusive: "2026-08-13" },
      { uid: "c", summary: "x", start: "", endExclusive: "2026-08-15" },
    ];
    assert.equal(buildIcs(bad, NOW).split("BEGIN:VEVENT").length - 1, 0);
  });

  it("予定が無くても壊れたカレンダーにならない", () => {
    const ics = buildIcs([], NOW);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
    assert.ok(ics.endsWith("END:VCALENDAR"));
    assert.ok(!ics.includes("VEVENT"));
  });

  it("長い行は折り返す（継続行は空白で始まる）", () => {
    const long = [{ uid: "u", summary: "あ".repeat(120), start: "2026-08-14", endExclusive: "2026-08-15" }];
    const lines = buildIcs(long, NOW).split("\r\n");
    const idx = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    assert.ok(lines[idx].length <= 70);
    assert.ok(lines[idx + 1].startsWith(" "));
  });
});
