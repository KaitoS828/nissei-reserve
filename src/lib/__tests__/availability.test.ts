import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAvailability, eachNight, isStayAvailable } from "../availability";

describe("eachNight", () => {
  it("チェックアウト日は含めない（泊単位）", () => {
    assert.deepEqual(eachNight("2026-08-01", "2026-08-04"), [
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("同日なら空", () => {
    assert.deepEqual(eachNight("2026-08-01", "2026-08-01"), []);
  });

  it("to が from より前なら空", () => {
    assert.deepEqual(eachNight("2026-08-05", "2026-08-01"), []);
  });

  it("月またぎでも連続する", () => {
    assert.deepEqual(eachNight("2026-08-30", "2026-09-02"), [
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });

  it("うるう日を飛ばさない", () => {
    assert.deepEqual(eachNight("2028-02-28", "2028-03-01"), ["2028-02-28", "2028-02-29"]);
  });
});

describe("computeAvailability", () => {
  it("予約が無ければ全泊で客室数がそのまま空く", () => {
    const avail = computeAvailability({
      roomCount: 1,
      reservations: [],
      blocked: [],
      from: "2026-08-01",
      to: "2026-08-03",
    });
    assert.deepEqual(avail, { "2026-08-01": 1, "2026-08-02": 1 });
  });

  it("既存予約のチェックアウト日は在庫を消費しない", () => {
    const avail = computeAvailability({
      roomCount: 1,
      reservations: [{ check_in: "2026-08-01", check_out: "2026-08-02" }],
      blocked: [],
      from: "2026-08-01",
      to: "2026-08-03",
    });
    // 8/1泊は埋まるが、8/2泊は空く＝チェックアウト当日に次の客を入れられる
    assert.equal(avail["2026-08-01"], 0);
    assert.equal(avail["2026-08-02"], 1);
  });

  it("予約不可日は両端を含めて在庫を潰す", () => {
    const avail = computeAvailability({
      roomCount: 1,
      reservations: [],
      blocked: [{ start_date: "2026-08-02", end_date: "2026-08-03" }],
      from: "2026-08-01",
      to: "2026-08-05",
    });
    assert.equal(avail["2026-08-01"], 1);
    assert.equal(avail["2026-08-02"], 0);
    assert.equal(avail["2026-08-03"], 0);
    assert.equal(avail["2026-08-04"], 1);
  });

  it("客室数を超える予約が入っていても負数にならない", () => {
    const avail = computeAvailability({
      roomCount: 1,
      reservations: [
        { check_in: "2026-08-01", check_out: "2026-08-02" },
        { check_in: "2026-08-01", check_out: "2026-08-02" },
      ],
      blocked: [],
      from: "2026-08-01",
      to: "2026-08-02",
    });
    assert.equal(avail["2026-08-01"], 0);
  });

  it("複数室あれば予約数だけ減る", () => {
    const avail = computeAvailability({
      roomCount: 3,
      reservations: [{ check_in: "2026-08-01", check_out: "2026-08-03" }],
      blocked: [],
      from: "2026-08-01",
      to: "2026-08-03",
    });
    assert.equal(avail["2026-08-01"], 2);
    assert.equal(avail["2026-08-02"], 2);
  });
});

describe("isStayAvailable", () => {
  const base = { roomCount: 1, blocked: [], from: "2026-08-01", to: "2026-08-04" };

  it("全泊空いていれば true", () => {
    assert.equal(isStayAvailable({ ...base, reservations: [] }), true);
  });

  it("途中1泊でも埋まっていれば false", () => {
    assert.equal(
      isStayAvailable({
        ...base,
        reservations: [{ check_in: "2026-08-02", check_out: "2026-08-03" }],
      }),
      false,
    );
  });

  it("既存予約のチェックアウト日から始まる滞在は取れる", () => {
    assert.equal(
      isStayAvailable({
        ...base,
        reservations: [{ check_in: "2026-07-30", check_out: "2026-08-01" }],
      }),
      true,
    );
  });

  it("既存予約のチェックイン日で終わる滞在は取れる", () => {
    assert.equal(
      isStayAvailable({
        ...base,
        reservations: [{ check_in: "2026-08-04", check_out: "2026-08-06" }],
      }),
      true,
    );
  });
});
