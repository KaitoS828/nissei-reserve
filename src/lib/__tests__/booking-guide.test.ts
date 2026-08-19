import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingGuideSubject, bookingGuideText, type BookingGuideInput } from "../booking-guide";

const base: BookingGuideInput = {
  guestName: "さー やん",
  code: "R-20260809-JHDV",
  checkIn: "2026-08-09",
  checkOut: "2026-08-10",
  checkInTime: "15:00",
  checkOutTime: "10:00",
  numGuests: 2,
  planName: "素泊まりプラン",
  doorPin: "129053",
  registerUrl: "https://reserve.gh-nissei.jp/register/abc123",
  lookupUrl: "https://reserve.gh-nissei.jp/reserve/lookup?code=R-20260809-JHDV&email=test%40example.com",
  phone: "070-1251-6275",
};

describe("bookingGuideSubject", () => {
  it("お名前を件名に入れる", () => {
    assert.equal(bookingGuideSubject("神部 葵"), "【日靜】ご宿泊のご案内（神部 葵様）");
  });

  it("前後の空白は落とす", () => {
    assert.equal(bookingGuideSubject("  神部 葵 "), "【日靜】ご宿泊のご案内（神部 葵様）");
  });

  it("名前が無ければ「様」だけの件名にしない", () => {
    assert.equal(bookingGuideSubject(null), "【日靜】ご宿泊のご案内");
    assert.equal(bookingGuideSubject("  "), "【日靜】ご宿泊のご案内");
  });
});

describe("bookingGuideText", () => {
  it("依頼された4点をすべて含む", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("宿泊者名簿"), "名簿の記載のお願い");
    assert.ok(text.includes(base.registerUrl!), "名簿の登録フォーム");
    assert.ok(text.includes(base.doorPin!), "鍵番号");
    assert.ok(text.includes("キーパッド"), "当日の鍵の開け方");
  });

  it("Wi-Fi の接続情報を載せる", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("nissei-guest"));
    assert.ok(text.includes("gh-nissei37"));
  });

  it("チェックイン・チェックアウト時刻を項目として載せる", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("チェックイン: 15:00 以降"));
    assert.ok(text.includes("チェックアウト: 10:00 まで"));
  });

  it("夜間の注意を含むお願いを載せる", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("お願い"));
    assert.ok(text.includes("漁師町"));
    assert.ok(text.includes("夜間"));
  });

  it("予約内容を載せる", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("R-20260809-JHDV"));
    assert.ok(text.includes("2名"));
    assert.ok(text.includes("素泊まりプラン"));
    assert.ok(text.includes("070-1251-6275"));
  });

  it("日付を曜日つきの和暦表記にする", () => {
    // 2026-08-09 は日曜
    assert.ok(bookingGuideText(base).includes("2026年8月9日(日)"));
  });

  it("宛名に様を付ける", () => {
    assert.ok(bookingGuideText(base).startsWith("さー やん 様"));
  });

  it("名前が無ければ「お客様」にする", () => {
    const text = bookingGuideText({ ...base, guestName: null });
    assert.ok(text.startsWith("お客様"));
    assert.ok(!text.includes("null"));
  });

  it("PIN 未発行なら番号を載せず、案内する", () => {
    const text = bookingGuideText({ ...base, doorPin: null });
    assert.ok(text.includes("ドアコードは"));
    assert.ok(!text.includes("129053"));
  });

  it("フォームURLが無ければURLを載せず、別途案内すると伝える", () => {
    const text = bookingGuideText({ ...base, registerUrl: null, lookupUrl: null });
    assert.ok(text.includes("別途ご案内"));
    assert.ok(!text.includes("https://"));
    // 名簿のお願い自体は消さない（法令要件なので）
    assert.ok(text.includes("宿泊者名簿"));
  });

  it("プランが無くても落ちない", () => {
    const text = bookingGuideText({ ...base, planName: null });
    assert.ok(text.includes("プラン: —"));
  });

  it("電話が無ければ電話行を出さない", () => {
    const text = bookingGuideText({ ...base, phone: null });
    assert.ok(!text.includes("電話:"));
    assert.ok(text.includes("お問い合わせ"));
  });

  it("有効期間はチェックイン時刻からチェックアウト時刻まで", () => {
    const text = bookingGuideText(base);
    assert.ok(text.includes("2026年8月9日(日) 15:00"));
    assert.ok(text.includes("2026年8月10日(月) 10:00"));
  });

  it("どの欠損があっても undefined や null が本文に出ない", () => {
    const text = bookingGuideText({
      ...base,
      guestName: null, planName: null, doorPin: null, registerUrl: null, phone: null,
    });
    assert.ok(!/undefined|null/.test(text));
  });
});
