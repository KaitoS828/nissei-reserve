import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chargeRate, computeRefund, daysUntil } from "../cancel";

// 7日以上前は無料 / 3〜6日前は50% / 0〜2日前は100%
const POLICY = { "7": 0, "3": 0.5, "0": 1 };

describe("chargeRate", () => {
  it("境界日でポリシーが切り替わる", () => {
    assert.equal(chargeRate(POLICY, 8), 0);
    assert.equal(chargeRate(POLICY, 7), 0);
    assert.equal(chargeRate(POLICY, 6), 0.5);
    assert.equal(chargeRate(POLICY, 3), 0.5);
    assert.equal(chargeRate(POLICY, 2), 1);
    assert.equal(chargeRate(POLICY, 0), 1);
  });

  it("チェックイン日を過ぎている場合も最大料率を返す", () => {
    // 0 を返すと、宿泊が終わった予約をキャンセルして全額返金できてしまう
    assert.equal(chargeRate(POLICY, -1), 1);
    assert.equal(chargeRate(POLICY, -2), 1);
    assert.equal(chargeRate(POLICY, -365), 1);
  });

  it("当日の閾値が無いポリシーでも、期日を過ぎたら一番厳しい料率になる", () => {
    // {"7":0,"3":0.5} のように 0 日の指定が無い場合でも 0 に落ちない
    assert.equal(chargeRate({ "7": 0, "3": 0.5 }, 1), 0.5);
    assert.equal(chargeRate({ "7": 0, "3": 0.5 }, -1), 0.5);
  });

  it("ポリシー未設定なら請求0（全額返金）", () => {
    assert.equal(chargeRate(null, 0), 0);
  });
});

describe("daysUntil", () => {
  it("同日は0", () => {
    assert.equal(daysUntil("2026-08-10", new Date(2026, 7, 10, 23, 59)), 0);
  });

  it("翌日は1", () => {
    assert.equal(daysUntil("2026-08-11", new Date(2026, 7, 10, 0, 1)), 1);
  });

  it("時刻に関係なく日付だけで数える", () => {
    const early = daysUntil("2026-08-20", new Date(2026, 7, 10, 0, 0));
    const late = daysUntil("2026-08-20", new Date(2026, 7, 10, 23, 59));
    assert.equal(early, late);
    assert.equal(early, 10);
  });

  it("過去日は負数になる", () => {
    assert.equal(daysUntil("2026-08-01", new Date(2026, 7, 10)), -9);
  });
});

describe("computeRefund", () => {
  it("7日以上前は全額返金", () => {
    const r = computeRefund(50000, "2026-08-20", POLICY, new Date(2026, 7, 1));
    assert.equal(r.chargeRate, 0);
    assert.equal(r.feeAmount, 0);
    assert.equal(r.refundAmount, 50000);
  });

  it("3〜6日前は50%のキャンセル料", () => {
    const r = computeRefund(50000, "2026-08-20", POLICY, new Date(2026, 7, 15));
    assert.equal(r.daysBefore, 5);
    assert.equal(r.feeAmount, 25000);
    assert.equal(r.refundAmount, 25000);
  });

  it("直前は全額キャンセル料で返金0", () => {
    const r = computeRefund(50000, "2026-08-20", POLICY, new Date(2026, 7, 19));
    assert.equal(r.feeAmount, 50000);
    assert.equal(r.refundAmount, 0);
  });

  it("キャンセル料は四捨五入する", () => {
    // 30001 * 0.5 = 15000.5 → 15001
    const r = computeRefund(30001, "2026-08-20", POLICY, new Date(2026, 7, 15));
    assert.equal(r.feeAmount, 15001);
    assert.equal(r.refundAmount, 15000);
  });

  it("返金額が負になることはない", () => {
    const r = computeRefund(0, "2026-08-20", POLICY, new Date(2026, 7, 19));
    assert.equal(r.refundAmount, 0);
    assert.ok(r.refundAmount >= 0);
  });

  it("キャンセル料と返金額の合計は元の金額に一致する", () => {
    for (const amount of [12345, 28000, 40000, 176400]) {
      const r = computeRefund(amount, "2026-08-20", POLICY, new Date(2026, 7, 15));
      assert.equal(r.feeAmount + r.refundAmount, amount);
    }
  });
});
