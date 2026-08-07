// smart-checkin-app-v2 の Supabase から nissei-reserve の Supabase へデータを移す。
//
// 旧アプリの reservations 1行は、こちらでは4テーブルに分かれる:
//   reservations（予約本体）/ reservation_checkins（チェックイン）
//   / access_keys（ドアPIN）/ reservation_guests（宿泊者名簿）
//
// 実行: node scripts/migrate-smart-checkin.mjs [--apply]
//   --apply を付けない限り書き込まない（何が起きるかだけ表示する）。
// 何度実行しても二重登録しないよう、予約は note の移行元IDで既存を判定する。

import fs from "fs";

const APPLY = process.argv.includes("--apply");

function readEnv(path) {
  const text = fs.readFileSync(path, "utf8");
  const out = {};
  // private key のように複数行を "" で囲った値にも対応する
  for (const m of text.matchAll(/^([A-Z_][A-Z0-9_]*)=("(?:[^"]|\n)*"|.*)$/gm)) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const src = readEnv("/Users/sekimotokaito/dev/active/smart-checkin-app-v2/.env.local");
const dst = readEnv("/Users/sekimotokaito/dev/active/nissei-reserve/.env.local");

function api(env) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return async (path, init = {}) => {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init.headers,
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body).slice(0, 300)}`);
    return body;
  };
}

const from = api(src);
const to = api(dst);

const MARK = "旧チェックインアプリから移行";
const note = (id) => `${MARK} (source_id=${id})`;

// 予約番号。旧IDから決まる形にして、再実行しても同じ番号になるようにする。
function codeFor(checkIn, sourceId) {
  return `R-${checkIn.replaceAll("-", "")}-M${sourceId.slice(0, 4).toUpperCase()}`;
}

async function main() {
  console.log(APPLY ? "=== 本実行（書き込みます）===" : "=== ドライラン（書き込みません）===");

  // ---- 1. 物件 ----
  const [srcProp] = await from("properties?select=*");
  const existingProps = await to(
    `properties?select=id,name&name=eq.${encodeURIComponent(srcProp.name)}`,
  );

  let propertyId = existingProps[0]?.id;
  if (propertyId) {
    console.log(`物件「${srcProp.name}」: 既にあるので流用 (${propertyId.slice(0, 8)})`);
  } else if (APPLY) {
    const [created] = await to("properties", {
      method: "POST",
      body: JSON.stringify({
        name: srcProp.name,
        address: srcProp.address,
        check_in_time: srcProp.check_in_time,
        check_out_time: srcProp.check_out_time,
        switchbot_keypad_device_id: srcProp.switchbot_keypad_device_id,
        google_calendar_id: srcProp.google_calendar_id,
        wifi_ssid: srcProp.wifi_ssid,
        wifi_password: srcProp.wifi_password,
        notes: srcProp.notes,
        ical_url: srcProp.ical_url,
        // 新規予約は受け付けない（記録として残すだけ）
        is_active: false,
      }),
    });
    propertyId = created.id;
    console.log(`物件「${srcProp.name}」: 作成 (${propertyId.slice(0, 8)}) is_active=false`);
  } else {
    console.log(`物件「${srcProp.name}」: 作成予定 is_active=false（新規予約は受け付けない）`);
  }

  // ---- 2. 予約 ----
  const reservations = await from("reservations?select=*&order=created_at");
  console.log(`\n予約 ${reservations.length} 件:`);

  for (const r of reservations) {
    const code = codeFor(r.check_in_date, r.id);
    const dup = await to(`reservations?select=id&code=eq.${code}`);
    if (dup.length > 0) {
      console.log(`  ${code}: 移行済みなのでスキップ`);
      continue;
    }

    const hasGuest = Boolean(r.guest_name || r.guest_address);
    const label = [
      r.check_in_date,
      r.stay_type,
      hasGuest ? "宿泊者情報あり" : "宿泊者情報なし",
      r.is_checked_in ? "チェックイン済" : "未チェックイン",
      r.door_pin ? "PINあり" : "PINなし",
    ].join(" / ");

    if (!APPLY) {
      console.log(`  ${code}: 作成予定  ${label}`);
      continue;
    }

    // 顧客。氏名があるときだけ作る（無い行に空の顧客を増やしても意味がないため）
    let customerId = null;
    if (r.guest_name) {
      const [c] = await to("customers", {
        method: "POST",
        body: JSON.stringify({
          last_name: r.guest_name,
          phone: r.guest_contact ?? null,
          note: note(r.id),
        }),
      });
      customerId = c.id;
    }

    // nights は生成列なので渡さない。金額は旧アプリが持っていないので 0。
    const [resv] = await to("reservations", {
      method: "POST",
      body: JSON.stringify({
        code,
        customer_id: customerId,
        property_id: propertyId,
        check_in: r.check_in_date,
        check_out: r.check_out_date ?? r.check_in_date,
        check_in_time: r.check_in_time ?? null,
        num_guests: 1,
        num_children: 0,
        amount: 0,
        status: "checked_out",
        payment_status: "unpaid",
        source: "admin",
        gcal_event_id: r.google_calendar_event_id ?? null,
        // 別物件の過去分なので、日靜のカレンダー・一覧・集計には出さない
        archived_at: new Date().toISOString(),
        note: note(r.id),
      }),
    });

    // チェックイン記録
    if (r.secret_code) {
      await to("reservation_checkins", {
        method: "POST",
        body: JSON.stringify({
          reservation_id: resv.id,
          secret_code: r.secret_code,
          status: r.is_checked_in ? "checked_in" : "pending",
          checked_in_at: r.is_checked_in ? r.updated_at : null,
          whereby_room_url: r.whereby_room_url ?? null,
          whereby_host_room_url: r.whereby_host_room_url ?? null,
          notes: note(r.id),
        }),
      });
    }

    // ドアPIN
    if (r.door_pin) {
      await to("access_keys", {
        method: "POST",
        body: JSON.stringify({
          reservation_id: resv.id,
          door_pin: r.door_pin,
          provider: "switchbot",
          switchbot_key_id: r.switchbot_key_id ?? null,
          // 過去分なので有効な鍵としては扱わない
          status: "expired",
          note: note(r.id),
        }),
      });
    }

    // 宿泊者名簿（旅館業法で3年保存）
    if (hasGuest) {
      await to("reservation_guests", {
        method: "POST",
        body: JSON.stringify({
          reservation_id: resv.id,
          guest_order: 1,
          full_name: r.guest_name ?? null,
          address: r.guest_address ?? null,
          contact: r.guest_contact ?? null,
          occupation: r.guest_occupation ?? null,
          gender: r.guest_gender ?? null,
          is_foreign_national: r.is_foreign_national ?? false,
          nationality: r.nationality ?? null,
          passport_number: r.passport_number ?? null,
          passport_image_url: r.passport_image_url ?? null,
        }),
      });
    }

    console.log(`  ${code}: 作成  ${label}`);
  }

  console.log(
    APPLY ? "\n完了" : "\n（--apply を付けると実際に書き込みます）",
  );
}

main().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
