import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isKeyForReservation, keypadKeyName } from "../smart-lock";

const CODE = "R-20260809-JHDV";

describe("keypadKeyName", () => {
  it("予約者名＋様＋予約番号にする", () => {
    assert.equal(keypadKeyName("さーやん", CODE), `さーやん様 ${CODE}`);
  });

  it("姓名が空白で区切られていてもそのまま入れる", () => {
    assert.equal(keypadKeyName("さー やん", CODE), `さー やん様 ${CODE}`);
  });

  it("前後の空白は落とす", () => {
    assert.equal(keypadKeyName("  さーやん  ", CODE), `さーやん様 ${CODE}`);
  });

  it("名前が無ければ予約番号だけにする（「様」だけの鍵を作らない）", () => {
    assert.equal(keypadKeyName(null, CODE), CODE);
    assert.equal(keypadKeyName(undefined, CODE), CODE);
    assert.equal(keypadKeyName("", CODE), CODE);
    assert.equal(keypadKeyName("   ", CODE), CODE);
  });

  it("どの形でも予約番号を必ず含む（照合できなくならない）", () => {
    for (const name of ["さーやん", "", null, "  "]) {
      assert.ok(isKeyForReservation(keypadKeyName(name, CODE), CODE));
    }
  });
});

describe("isKeyForReservation", () => {
  it("予約番号を含む鍵を自分のものと判定する", () => {
    assert.equal(isKeyForReservation(`さーやん様 ${CODE}`, CODE), true);
    assert.equal(isKeyForReservation(CODE, CODE), true);
  });

  it("表示名が変わっても予約番号が残っていれば見つけられる", () => {
    // 顧客名を後から修正しても、キャンセル時に鍵を消せなくならないこと
    assert.equal(isKeyForReservation(`関本様 ${CODE}`, CODE), true);
  });

  it("別の予約の鍵を巻き込まない", () => {
    assert.equal(isKeyForReservation("さーやん様 R-20260810-ABCD", CODE), false);
    assert.equal(isKeyForReservation("常に有効パスコード1", CODE), false);
    assert.equal(isKeyForReservation("エアビー", CODE), false);
  });

  it("予約番号が前方一致するだけの別コードと混同しない", () => {
    // R-20260809-JHDV と R-20260809-JHDVX は別物
    assert.equal(isKeyForReservation("さーやん様 R-20260809-JHDX", CODE), false);
  });
});
