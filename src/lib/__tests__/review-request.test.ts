import { describe, it } from "node:test";
import assert from "node:assert";
import {
  reviewRequestSubject,
  reviewRequestText,
  reviewRequestHtml,
  DEFAULT_GOOGLE_REVIEW_URL,
} from "../review-request";

describe("reviewRequestSubject", () => {
  it("件名を統一して返す", () => {
    assert.strictEqual(
      reviewRequestSubject("山田 太郎"),
      "【一棟貸し宿 日靜】ご宿泊の御礼とご感想（口コミ）のお願い",
    );
    assert.strictEqual(
      reviewRequestSubject(null),
      "【一棟貸し宿 日靜】ご宿泊の御礼とご感想（口コミ）のお願い",
    );
  });
});

describe("reviewRequestText & reviewRequestHtml", () => {
  const sample = {
    guestName: "山田 太郎",
    code: "R-20260819-ABCD",
    checkIn: "2026-08-18",
    checkOut: "2026-08-19",
    phone: "070-1251-6275",
  };

  it("テキスト本文にお礼、ログイン注意、レビューURLが含まれる", () => {
    const text = reviewRequestText(sample);
    assert.ok(text.includes("山田 太郎 様"));
    assert.ok(text.includes("お部屋を大変綺麗にご利用いただき心より感謝申し上げます"));
    assert.ok(text.includes("※Googleへのログインが必要です"));
    assert.ok(text.includes(DEFAULT_GOOGLE_REVIEW_URL));
    assert.ok(text.includes("R-20260819-ABCD"));
  });

  it("HTML本文にGoogleクチコミボタン、ログイン注意、リンクが含まれる", () => {
    const html = reviewRequestHtml(sample);
    assert.ok(html.includes("山田 太郎 様"));
    assert.ok(html.includes("お部屋を大変綺麗にご利用いただき"));
    assert.ok(html.includes("※ご投稿にはGoogleアカウントへのログインが必要となります"));
    assert.ok(html.includes(DEFAULT_GOOGLE_REVIEW_URL));
    assert.ok(html.includes("Googleクチコミを投稿する"));
  });
});
