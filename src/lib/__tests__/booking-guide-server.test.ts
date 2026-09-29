import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { originFromHeaders } from "../booking-guide-server";

const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

describe("originFromHeaders", () => {
  it("Vercelのデプロイ個別URLで呼ばれても、本番ドメインを返す", () => {
    const h = headers({ host: "nissei-reserve-hseydpvf1-kaitos828s-projects.vercel.app" });
    assert.equal(originFromHeaders(h), "https://reserve.gh-nissei.jp");
  });

  it("プロジェクトのvercel.appで呼ばれても、本番ドメインを返す", () => {
    assert.equal(originFromHeaders(headers({ host: "nissei-reserve.vercel.app" })), "https://reserve.gh-nissei.jp");
  });

  it("origin ヘッダーがvercel.appでも、本番ドメインを返す", () => {
    const h = headers({ host: "reserve.gh-nissei.jp", origin: "https://nissei-reserve.vercel.app" });
    assert.equal(originFromHeaders(h), "https://reserve.gh-nissei.jp");
  });

  it("ヘッダーが無くても、本番ドメインを返す", () => {
    assert.equal(originFromHeaders(headers({})), "https://reserve.gh-nissei.jp");
  });

  it("ローカル開発だけは http の localhost を返す", () => {
    assert.equal(originFromHeaders(headers({ host: "localhost:3033" })), "http://localhost:3033");
  });
});
