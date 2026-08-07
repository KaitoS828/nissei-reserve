// SwitchBot キーパッドの時間限定パスコード発行。
// smart-checkin-app-v2 で実運用していた実装を移植した。
// 未設定・失敗しても予約フローは止めない（PINは後から手動でも配れるため）。

import crypto from "crypto";
import { createAdminClient } from "./supabase/admin";

const API = "https://api.switch-bot.com/v1.1";

function credentials() {
  const token = process.env.SWITCHBOT_TOKEN;
  const secret = process.env.SWITCHBOT_SECRET;
  const deviceId = process.env.SWITCHBOT_KEYPAD_DEVICE_ID;
  if (!token || !secret || !deviceId) return null;
  return { token, secret, deviceId };
}

// SwitchBot API v1.1 の署名。token + t + nonce を secret で HMAC-SHA256 する。
function buildHeaders(token: string, secret: string) {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const sign = crypto
    .createHmac("sha256", secret)
    .update(token + t + nonce)
    .digest("base64")
    .toUpperCase();
  return { Authorization: token, sign, t, nonce, "Content-Type": "application/json" };
}

async function command(
  deviceId: string,
  token: string,
  secret: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/devices/${deviceId}/commands`, {
    method: "POST",
    headers: buildHeaders(token, secret),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { statusCode?: number; body?: Record<string, unknown> };
  // SwitchBot は HTTP 200 でも statusCode で成否を返す
  if (data.statusCode !== 100) {
    throw new Error(`SwitchBot エラー: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.body ?? {};
}

function randomPin(): string {
  // キーパッドの想定桁数に合わせて4桁。先頭0を避けるため 1000〜9999。
  return String(crypto.randomInt(1000, 10000));
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

type IssueArgs = {
  reservationId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut?: string | null; // YYYY-MM-DD。無ければ翌日
  checkInTime?: string; // HH:MM (JST)
  checkOutTime?: string; // HH:MM (JST)
  label?: string; // キーパッド上の識別名
};

export type IssueResult =
  | { ok: true; doorPin: string; keyId: number | null }
  | { ok: false; reason: string };

/** 予約にドアPINを発行し、SwitchBot に登録して access_keys に保存する。 */
export async function issueDoorPin(args: IssueArgs): Promise<IssueResult> {
  const cred = credentials();
  if (!cred) return { ok: false, reason: "SwitchBot の認証情報が未設定です" };

  const supabase = createAdminClient();

  // 同じ予約に何度も鍵を作らない（webhook のリトライで二重発行されうるため）
  const { data: existing } = await supabase
    .from("access_keys")
    .select("door_pin, switchbot_key_id")
    .eq("reservation_id", args.reservationId)
    .in("status", ["pending", "issued"])
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      doorPin: existing.door_pin as string,
      keyId: (existing.switchbot_key_id as number | null) ?? null,
    };
  }

  const doorPin = randomPin();
  const checkOut = args.checkOut ?? nextDay(args.checkIn);
  const validFrom = new Date(`${args.checkIn}T${args.checkInTime ?? "15:00"}:00+09:00`);
  const validUntil = new Date(`${checkOut}T${args.checkOutTime ?? "11:00"}:00+09:00`);

  let keyId: number | null = null;
  try {
    const body = await command(cred.deviceId, cred.token, cred.secret, {
      command: "createKey",
      commandType: "command",
      parameter: {
        name: args.label ?? `予約 ${args.reservationId.slice(0, 8)}`,
        type: "timeLimit",
        password: doorPin,
        startTime: Math.floor(validFrom.getTime() / 1000),
        endTime: Math.floor(validUntil.getTime() / 1000),
      },
    });
    keyId = (body.keyId as number | undefined) ?? null;
  } catch (e) {
    console.error("SwitchBot への鍵登録に失敗:", e);
    return { ok: false, reason: e instanceof Error ? e.message : "SwitchBot 登録に失敗" };
  }

  const { error } = await supabase.from("access_keys").insert({
    reservation_id: args.reservationId,
    door_pin: doorPin,
    provider: "switchbot",
    switchbot_key_id: keyId,
    status: "issued",
    valid_from: validFrom.toISOString(),
    valid_until: validUntil.toISOString(),
    issued_at: new Date().toISOString(),
  });
  if (error) {
    // キーパッド側には登録済みなので、DBだけ失敗した状態を残さないよう巻き戻す
    if (keyId !== null) await revokeSwitchBotKey(keyId).catch(() => {});
    return { ok: false, reason: error.message };
  }

  return { ok: true, doorPin, keyId };
}

async function revokeSwitchBotKey(keyId: number): Promise<void> {
  const cred = credentials();
  if (!cred) return;
  await command(cred.deviceId, cred.token, cred.secret, {
    command: "deleteKey",
    commandType: "command",
    parameter: { id: keyId },
  });
}

/** 予約のドアPINを無効化する（キャンセル時など）。
 *
 *  注意: 現行のキーパッド（Keypad Touch）は createKey が keyId を返さないため、
 *  キーパッド側の登録を API から消せない。鍵は滞在期間だけ有効な timeLimit なので
 *  期間外には使えないが、「キャンセルされた予約の PIN が元の宿泊期間中は通る」点は
 *  残る。取り消しが必要なときは SwitchBot アプリから手動で削除する必要があるため、
 *  消せなかったことを note に残して分かるようにしておく。
 */
export async function revokeDoorPin(reservationId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: keys } = await supabase
    .from("access_keys")
    .select("id, door_pin, switchbot_key_id, note")
    .eq("reservation_id", reservationId)
    .in("status", ["pending", "issued"]);

  for (const k of keys ?? []) {
    let removedFromKeypad = false;
    if (k.switchbot_key_id !== null) {
      removedFromKeypad = await revokeSwitchBotKey(k.switchbot_key_id as number)
        .then(() => true)
        .catch((e) => {
          console.error("SwitchBot の鍵削除に失敗:", e);
          return false;
        });
    } else {
      console.warn(
        `keyId が無いためキーパッドから削除できません（PIN ${k.door_pin}）。SwitchBot アプリで手動削除してください。`,
      );
    }

    await supabase
      .from("access_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        note: removedFromKeypad
          ? k.note
          : [k.note, "キーパッド未削除（手動削除が必要）"].filter(Boolean).join(" / "),
      })
      .eq("id", k.id);
  }
}
