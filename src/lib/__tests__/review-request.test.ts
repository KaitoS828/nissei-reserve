import { describe, it } from "node:test";
import assert from "node:assert";
import {
  reviewRequestSubject,
  reviewRequestText,
  reviewRequestHtml,
  DEFAULT_GOOGLE_REVIEW_URL,
} from "../review-request";

describe("reviewRequestSubject", () => {
  it("名前があれば件名に入れる", () => {
    assert.strictEqual(
      reviewRequestSubject("山田 太郎"),
      "【一棟貸し宿 日靜】ご宿泊の御礼とご感想（口コミ）のお願い（山田 太郎様）",
    );
  });

  it("名前が無ければ汎用の件名にする", () => {
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

  it("テキスト本文にお礼と綺麗に使っていただいた感謝、レビューURLが含まれる", () => {
    const text = reviewRequestText(sample);
    assert.ok(text.includes("山田 太郎 様"));
    assert.ok(text.includes("お部屋を大変綺麗にご利用いただき心より感謝申し上げます"));
    assert.ok(text.includes(DEFAULT_GOOGLE_REVIEW_URL));
    assert.ok(text.includes("R-20260819-ABCD"));
  });

  it("HTML本文にGoogleクチコミボタンとリンクが含まれる", () => {
    const html = reviewRequestHtml(sample);
    assert.ok(html.includes("山田 太郎 様"));
    assert.ok(html.includes("お部屋を大変綺麗にご利用いただき"));
    assert.ok(html.includes(DEFAULT_GOOGLE_REVIEW_URL));
    assert.ok(html.includes("Googleクチコミを投稿する"));
  });
});
