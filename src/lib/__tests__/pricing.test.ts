import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcPrice,
  guestPricesFromRule,
  guestRange,
  nightlyRateForGuests,
  pickDiscount,
} from "../pricing";

describe("nightlyRateForGuests", () => {
  const prices = { "2": 20000, "5": 11500, "6": 13000 };

  it("人数がキーに一致すればその単価を使う", () => {
    assert.equal(nightlyRateForGuests(2, prices, 99999), 20000);
    assert.equal(nightlyRateForGuests(6, prices, 99999), 13000);
  });

  it("一致するキーが無ければ、その人数を超えない最大キーを使う", () => {
    // 3名・4名は「2名以上」の単価が適用される（日帰りKOBUの 2〜4名一律 と同じ考え方）
    assert.equal(nightlyRateForGuests(3, prices, 99999), 20000);
    assert.equal(nightlyRateForGuests(4, prices, 99999), 20000);
  });

  it("最小キーを下回る人数では最小キーの単価にフォールバックする", () => {
    // 最低2名のプランに1名で来た場合。予約可否は guestRange 側で弾く前提
    assert.equal(nightlyRateForGuests(1, prices, 99999), 20000);
  });

  it("guest_prices が無ければ fallback を使う", () => {
    assert.equal(nightlyRateForGuests(3, null, 28000), 28000);
    assert.equal(nightlyRateForGuests(3, undefined, 28000), 28000);
  });

  it("0円のキーは無効として fallback に落ちる", () => {
    assert.equal(nightlyRateForGuests(2, { "2": 0 }, 28000), 28000);
  });
});

describe("guestRange", () => {
  it("最小キーが最低人数になる（最低2名のプラン）", () => {
    // "1" のキーを持たせないことで1名予約を不可にしている
    assert.deepEqual(guestRange({ "2": 20000, "5": 11500, "6": 13000 }, 6), {
      min: 2,
      max: 6,
    });
  });

  it("1名から受けるプランは最低1名になる", () => {
    assert.deepEqual(guestRange({ "1": 7000, "2": 14000 }, 6), { min: 1, max: 6 });
  });

  it("最大人数は客室定員で決まる（料金キーの数ではない）", () => {
    assert.equal(guestRange({ "2": 20000 }, 6).max, 6);
  });

  it("guest_prices が無ければ 1〜定員", () => {
    assert.deepEqual(guestRange(null, 4), { min: 1, max: 4 });
  });

  it("定員が未設定なら最大キーで代替する", () => {
    assert.deepEqual(guestRange({ "2": 20000, "6": 13000 }, 0), { min: 2, max: 6 });
  });

  it("最低人数が定員を上回っても max が min を下回らない", () => {
    assert.deepEqual(guestRange({ "2": 20000 }, 1), { min: 2, max: 2 });
  });

  it("整数でないキーや0以下のキーは無視する", () => {
    assert.deepEqual(guestRange({ "0": 100, "2": 20000, abc: 300 }, 6), {
      min: 2,
      max: 6,
    });
  });
});

describe("guestPricesFromRule", () => {
  it("人数課金は 人数×単価 を各人数ぶん展開する", () => {
    // 素泊まり ¥7,000/人（1〜6名）
    assert.deepEqual(
      guestPricesFromRule({
        type: "per_person",
        amount_per_person: 7000,
        min_guests: 1,
        max_guests: 3,
      }),
      { "1": 7000, "2": 14000, "3": 21000 },
    );
  });

  it("最低人数より下のキーは作らない（1名予約を不可にできる）", () => {
    const prices = guestPricesFromRule({
      type: "per_person",
      amount_per_person: 10000,
      min_guests: 2,
      max_guests: 3,
    });
    assert.equal(prices["1"], undefined);
    assert.deepEqual(guestRange(prices, 6).min, 2);
  });

  it("定額課金はどの人数でも同じ金額になる", () => {
    // 日帰りKOBU の 2〜4名一律
    assert.deepEqual(
      guestPricesFromRule({
        type: "fixed",
        fixed_amount: 20000,
        min_guests: 2,
        max_guests: 4,
      }),
      { "2": 20000, "3": 20000, "4": 20000 },
    );
  });

  it("最低料金を下回る人数では最低料金まで引き上げる", () => {
    assert.deepEqual(
      guestPricesFromRule({
        type: "per_person",
        amount_per_person: 10000,
        min_guests: 2,
        max_guests: 3,
        minimum_charge: 25000,
      }),
      { "2": 25000, "3": 30000 },
    );
  });

  it("最大人数が未指定なら最低人数のぶんだけ作る", () => {
    assert.deepEqual(
      guestPricesFromRule({ type: "per_person", amount_per_person: 7000, min_guests: 2 }),
      { "2": 14000 },
    );
  });

  it("金額が未設定でも落ちずに0円になる", () => {
    assert.deepEqual(guestPricesFromRule({ type: "fixed", min_guests: 1, max_guests: 1 }), {
      "1": 0,
    });
  });
});

describe("pickDiscount", () => {
  const discounts = [
    { min: 3, max: 6, rate: 0.1 },
    { min: 7, max: null, rate: 0.2 },
  ];

  it("該当しない泊数では割引なし", () => {
    assert.equal(pickDiscount(2, discounts), 0);
  });

  it("範囲に入る割引を適用する", () => {
    assert.equal(pickDiscount(3, discounts), 0.1);
    assert.equal(pickDiscount(6, discounts), 0.1);
    assert.equal(pickDiscount(7, discounts), 0.2);
    assert.equal(pickDiscount(30, discounts), 0.2);
  });

  it("複数該当する場合は最も割引率が高いものを選ぶ", () => {
    const overlapping = [
      { min: 3, max: null, rate: 0.1 },
      { min: 5, max: null, rate: 0.25 },
    ];
    assert.equal(pickDiscount(5, overlapping), 0.25);
  });

  it("割引定義が空なら0", () => {
    assert.equal(pickDiscount(10, []), 0);
  });
});

describe("calcPrice", () => {
  it("泊数×単価から小計を出し、割引を引いた総額を返す", () => {
    const price = calcPrice("2026-08-01", "2026-08-08", 28000, [
      { min: 7, max: null, rate: 0.1 },
    ]);
    assert.equal(price.nights, 7);
    assert.equal(price.subtotal, 196000);
    assert.equal(price.discountRate, 0.1);
    assert.equal(price.discountAmount, 19600);
    assert.equal(price.total, 176400);
  });

  it("チェックアウト日は泊数に数えない", () => {
    const price = calcPrice("2026-08-01", "2026-08-02", 28000);
    assert.equal(price.nights, 1);
    assert.equal(price.total, 28000);
  });

  it("同日 from/to は0泊・0円", () => {
    const price = calcPrice("2026-08-01", "2026-08-01", 28000);
    assert.equal(price.nights, 0);
    assert.equal(price.total, 0);
  });

  it("月をまたぐ日程でも泊数が合う", () => {
    assert.equal(calcPrice("2026-08-30", "2026-09-02", 10000).nights, 3);
  });

  it("うるう日を含む日程でも泊数が合う", () => {
    assert.equal(calcPrice("2028-02-27", "2028-03-01", 10000).nights, 3);
  });

  it("割引額は四捨五入する", () => {
    // 3泊 × 10001 = 30003、15%引き = 4500.45 → 4500
    const price = calcPrice("2026-08-01", "2026-08-04", 10001, [
      { min: 3, max: null, rate: 0.15 },
    ]);
    assert.equal(price.discountAmount, 4500);
    assert.equal(price.total, 25503);
  });
});
