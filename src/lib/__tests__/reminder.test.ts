import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderSubject, reminderText, tomorrowJst, type ReminderInput } from "../reminder";

const base: ReminderInput = {
  guestName: "神部 葵",
  code: "R-20260814-KFKZ",
  checkIn: "2026-08-14",
  checkOut: "2026-08-15",
  checkInTime: "15:00",
  numGuests: 2,
  registeredGuests: 2,
  doorPin: "129053",
  registerUrl: "https://reserve.gh-nissei.jp/register/abc123",
  lookupUrl: "https://reserve.gh-nissei.jp/reserve/lookup?code=R-20260814-KFKZ&email=test%40example.com",
  phone: "070-1251-6275",
};

describe("reminderSubject", () => {
  it("お名前を件名に入れる", () => {
    assert.equal(reminderSubject("神部 葵"), "【日靜】明日のご宿泊について（神部 葵様）");
  });

  it("名前が無ければ「様」だけの件名にしない", () => {
    assert.equal(reminderSubject(null), "【日靜】明日のご宿泊について");
    assert.equal(reminderSubject("  "), "【日靜】明日のご宿泊について");
  });
});

describe("reminderText", () => {
  it("日程とドアコードを載せる", () => {
    const text = reminderText(base);
    assert.ok(text.includes("2026年8月14日(金)"));
    assert.ok(text.includes("129053"));
    assert.ok(text.includes("キーパッド"));
  });

  it("名簿が揃っていれば催促しない", () => {
    const text = reminderText(base);
    assert.ok(!text.includes("ご記入をお願いいたします"));
  });

  it("名簿が足りなければ残り人数を伝えて催促する", () => {
    const text = reminderText({ ...base, registeredGuests: 1 });
    assert.ok(text.includes("1 / 2 名分"));
    assert.ok(text.includes("残り1名分"));
    assert.ok(text.includes(base.registerUrl!));
  });

  it("1人も記入が無ければ全員分を促す", () => {
    const text = reminderText({ ...base, registeredGuests: 0 });
    assert.ok(text.includes("0 / 2 名分"));
    assert.ok(text.includes("残り2名分"));
  });

  it("フォームURLが無ければ催促の節を出さない（開けないURLを載せない）", () => {
    const text = reminderText({ ...base, registeredGuests: 0, registerUrl: null });
    assert.ok(!text.includes("宿泊者名簿のご記入をお願い"));
  });

  it("PIN 未発行なら番号を載せず、連絡すると伝える", () => {
    const text = reminderText({ ...base, doorPin: null });
    assert.ok(text.includes("ドアコードは"));
    assert.ok(!text.includes("129053"));
  });

  it("末尾に施設名と住所を載せる", () => {
    const text = reminderText(base);
    assert.ok(text.includes("一棟貸し宿「日靜」"));
    assert.ok(text.includes("北海道広尾郡広尾町音調津733番地"));
  });

  it("どの欠損があっても undefined や null が本文に出ない", () => {
    const text = reminderText({
      ...base,
      guestName: null, doorPin: null, registerUrl: null, phone: null,
    });
    assert.ok(!/undefined|null/.test(text));
  });
});

describe("tomorrowJst", () => {
  it("日本時間の翌日を返す", () => {
    // 2026-08-14 12:00 JST = 03:00 UTC
    assert.equal(tomorrowJst(new Date("2026-08-14T03:00:00Z")), "2026-08-15");
  });

  it("UTCでは前日でも、日本時間の日付で判断する", () => {
    // 2026-08-14 08:00 JST = 2026-08-13 23:00 UTC
    assert.equal(tomorrowJst(new Date("2026-08-13T23:00:00Z")), "2026-08-15");
  });

  it("月・年をまたいでもずれない", () => {
    assert.equal(tomorrowJst(new Date("2026-08-31T03:00:00Z")), "2026-09-01");
    assert.equal(tomorrowJst(new Date("2026-12-31T03:00:00Z")), "2027-01-01");
  });
});
