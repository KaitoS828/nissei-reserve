// SwitchBot キーパッドの時間限定パスコード発行。
// 未設定・失敗しても予約フローは止めない（PINは後から手動でも配れるため）。
//
// SwitchBot API の性質（実機で確認済み）:
//  - createKey / deleteKey は statusCode 100 を返すが、これは「コマンドを受け付けた」
//    という意味しかない。キーパッドが実際に登録したかは分からない。
//  - createKey のレスポンス body は常に空で、発行された鍵の id は返らない。
//  - id は GET /devices のキーパッドの keyList から name で引ける。ただし keyList への
//    反映は数分遅れる（削除は20秒程度で反映される）。
//  - このため発行直後に id は確定できない。鍵の name に予約コードを使い、削除時に
//    name から id を引く。

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

type Cred = NonNullable<ReturnType<typeof credentials>>;

async function command(cred: Cred, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API}/devices/${cred.deviceId}/commands`, {
    method: "POST",
    headers: buildHeaders(cred.token, cred.secret),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { statusCode?: number };
  // HTTP 200 でも statusCode で成否を返す。100 でもキーパッドが受理したとは限らない。
  if (data.statusCode !== 100) {
    throw new Error(`SwitchBot エラー: ${JSON.stringify(data).slice(0, 200)}`);
  }
}

type KeypadKey = { id: number; name: string; type: string; status: string };

/** キーパッドに登録済みのパスコード一覧。反映は数分遅れることがある。 */
async function listKeypadKeys(cred: Cred): Promise<KeypadKey[]> {
  const res = await fetch(`${API}/devices`, {
    headers: buildHeaders(cred.token, cred.secret),
  });
  const data = (await res.json()) as {
    statusCode?: number;
    body?: { deviceList?: { deviceId: string; keyList?: KeypadKey[] }[] };
  };
  if (data.statusCode !== 100) {
    throw new Error(`SwitchBot エラー: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const device = data.body?.deviceList?.find((d) => d.deviceId === cred.deviceId);
  return device?.keyList ?? [];
}

function randomPin(): string {
  // SwitchBot の仕様上パスコードは 6〜12 桁。4桁だとキーパッドに登録されない。
  return String(crypto.randomInt(100000, 1000000));
}

/** キーパッド上の識別名。予約コードは一意なので、これで後から id を引ける。 */
function keyName(code: string): string {
  return code;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

type IssueArgs = {
  reservationId: string;
  code: string; // 予約コード。キーパッド上の鍵の名前に使う
  checkIn: string; // YYYY-MM-DD
  checkOut?: string | null; // YYYY-MM-DD。無ければ翌日
  checkInTime?: string; // HH:MM (JST)
  checkOutTime?: string; // HH:MM (JST)
};

export type IssueResult = { ok: true; doorPin: string } | { ok: false; reason: string };

/** 予約にドアPINを発行し、SwitchBot に登録して access_keys に保存する。 */
export async function issueDoorPin(args: IssueArgs): Promise<IssueResult> {
  const cred = credentials();
  if (!cred) return { ok: false, reason: "SwitchBot の認証情報が未設定です" };

  const supabase = createAdminClient();

  // 同じ予約に何度も鍵を作らない（webhook のリトライで二重発行されうるため）
  const { data: existing } = await supabase
    .from("access_keys")
    .select("door_pin")
    .eq("reservation_id", args.reservationId)
    .in("status", ["pending", "issued"])
    .maybeSingle();
  if (existing) return { ok: true, doorPin: existing.door_pin as string };

  const name = keyName(args.code);
  // 同名の鍵があると createKey は（成功を返したまま）登録されない。先に消しておく。
  const stale = (await listKeypadKeys(cred)).find((k) => k.name === name);
  if (stale) {
    await command(cred, {
      command: "deleteKey",
      commandType: "command",
      parameter: { id: stale.id },
    });
  }

  const doorPin = randomPin();
  const checkOut = args.checkOut ?? nextDay(args.checkIn);
  const validFrom = new Date(`${args.checkIn}T${args.checkInTime ?? "15:00"}:00+09:00`);
  const validUntil = new Date(`${checkOut}T${args.checkOutTime ?? "11:00"}:00+09:00`);

  try {
    await command(cred, {
      command: "createKey",
      commandType: "command",
      parameter: {
        name,
        type: "timeLimit",
        password: doorPin,
        startTime: Math.floor(validFrom.getTime() / 1000),
        endTime: Math.floor(validUntil.getTime() / 1000),
      },
    });
  } catch (e) {
    console.error("SwitchBot への鍵登録に失敗:", e);
    return { ok: false, reason: e instanceof Error ? e.message : "SwitchBot 登録に失敗" };
  }

  // id は今は取れない（keyList への反映が数分遅れる）。削除時に name から引く。
  const { error } = await supabase.from("access_keys").insert({
    reservation_id: args.reservationId,
    door_pin: doorPin,
    provider: "switchbot",
    status: "issued",
    valid_from: validFrom.toISOString(),
    valid_until: validUntil.toISOString(),
    issued_at: new Date().toISOString(),
  });
  if (error) {
    // キーパッド側には登録済みなので、DBだけ失敗した状態を残さないよう巻き戻す
    await revokeByName(cred, name).catch(() => {});
    return { ok: false, reason: error.message };
  }

  return { ok: true, doorPin };
}

/** キーパッドから name で鍵を探して削除する。見つからなければ false。 */
async function revokeByName(cred: Cred, name: string): Promise<boolean> {
  const key = (await listKeypadKeys(cred)).find((k) => k.name === name);
  if (!key) return false;
  await command(cred, {
    command: "deleteKey",
    commandType: "command",
    parameter: { id: key.id },
  });
  return true;
}

/** 予約のドアPINを無効化する（キャンセル時など）。 */
export async function revokeDoorPin(reservationId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: keys } = await supabase
    .from("access_keys")
    .select("id, door_pin, note")
    .eq("reservation_id", reservationId)
    .in("status", ["pending", "issued"]);
  if (!keys?.length) return;

  const { data: resv } = await supabase
    .from("reservations")
    .select("code")
    .eq("id", reservationId)
    .maybeSingle();

  const cred = credentials();
  let removed = false;
  let problem: string | null = null;

  if (!cred) {
    problem = "SwitchBot 未設定のためキーパッド未削除";
  } else if (!resv?.code) {
    problem = "予約コード不明でキーパッドから鍵を特定できず未削除";
  } else {
    try {
      // keyList に無い＝キーパッドに登録されていない。消す対象が無いので正常扱い。
      removed = await revokeByName(cred, keyName(resv.code as string));
    } catch (e) {
      console.error("SwitchBot の鍵削除に失敗:", e);
      problem = "キーパッド未削除（手動削除が必要）";
    }
  }

  if (problem) {
    console.warn(`${problem}: 予約 ${reservationId}`);
  } else if (!removed) {
    console.info(`キーパッドに該当の鍵が無いため削除不要: 予約 ${reservationId}`);
  }

  for (const k of keys) {
    await supabase
      .from("access_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        note: problem ? [k.note, problem].filter(Boolean).join(" / ") : k.note,
      })
      .eq("id", k.id);
  }
}
