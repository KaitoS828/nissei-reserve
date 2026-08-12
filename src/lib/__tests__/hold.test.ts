import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKOUT_WINDOW_MINUTES, staleBefore } from "../hold";

describe("CHECKOUT_WINDOW_MINUTES", () => {
  it("Stripe が受け付ける下限（30分）以上にする", () => {
    // これを下回るとセッション作成自体が失敗する
    assert.ok(CHECKOUT_WINDOW_MINUTES >= 30);
  });
});

describe("staleBefore", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("決済の猶予を過ぎたものだけを対象にする", () => {
    // 既定は 30分（決済猶予）+ 30分（通知の遅れを待つ）= 60分前
    assert.equal(staleBefore(now), "2026-08-12T11:00:00.000Z");
  });

  it("決済中のお客様を巻き込まない", () => {
    // 期限切れの瞬間より必ず前を指す＝まだ有効なセッションは対象外
    const cutoff = new Date(staleBefore(now)).getTime();
    const stillValid = now.getTime() - CHECKOUT_WINDOW_MINUTES * 60_000;
    assert.ok(cutoff < stillValid);
  });

  it("待ち時間は変えられる", () => {
    assert.equal(staleBefore(now, 120), "2026-08-12T10:00:00.000Z");
  });
});
