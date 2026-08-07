import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ipFromRequest, rateLimit, resetRateLimits } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("上限までは通し、超えた分を弾く", () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(rateLimit("k", 5, 60_000).ok, true, `${i + 1}回目は通るはず`);
    }
    assert.equal(rateLimit("k", 5, 60_000).ok, false);
  });

  it("弾いたときに待ち秒数を返す", () => {
    rateLimit("k", 1, 60_000);
    const blocked = rateLimit("k", 1, 60_000);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 60);
  });

  it("キーが違えば互いに影響しない", () => {
    rateLimit("a", 1, 60_000);
    assert.equal(rateLimit("a", 1, 60_000).ok, false);
    assert.equal(rateLimit("b", 1, 60_000).ok, true);
  });

  it("ウィンドウが切れたら計数がリセットされる", async () => {
    assert.equal(rateLimit("k", 1, 20).ok, true);
    assert.equal(rateLimit("k", 1, 20).ok, false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(rateLimit("k", 1, 20).ok, true);
  });
});

describe("ipFromRequest", () => {
  const make = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("x-forwarded-for の先頭を実クライアントとして使う", () => {
    assert.equal(
      ipFromRequest(make({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" })),
      "203.0.113.9",
    );
  });

  it("x-forwarded-for が無ければ x-real-ip を見る", () => {
    assert.equal(ipFromRequest(make({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
  });

  it("どちらも無ければ unknown（制限を素通りさせない）", () => {
    assert.equal(ipFromRequest(make({})), "unknown");
  });
});
