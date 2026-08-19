// 予約行から案内文の入力を作る。予約リストの表示と実際の送信で
// 文面がずれないよう、組み立てはここ1箇所にまとめる。

import type { BookingGuideInput } from "./booking-guide";

// 案内文を作るのに必要な最小の select。表示側と送信側で同じものを使う。
export const GUIDE_SELECT =
  "id, code, check_in, check_out, check_in_time, num_guests, status, customers(last_name, first_name, email), plans(name), access_keys(door_pin, status)";

/** リクエストヘッダから公開URLの起点を作る。
 *  ローカル開発は http なので、https を決め打ちすると案内文のURLが開けなくなる。 */
export function originFromHeaders(h: { get(name: string): string | null }): string {
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "reserve.gh-nissei.jp";
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  return `${isLocal ? "http" : "https"}://${host}`;
}

export type GuideRow = {
  id: string;
  code: string;
  check_in: string;
  check_out: string;
  check_in_time?: string | null;
  num_guests: number;
  customers?: { last_name: string | null; first_name: string | null; email: string | null } | null;
  plans?: { name: string } | null;
  access_keys?: { door_pin: string; status: string } | null;
};

export type GuideFacility = {
  check_in_time?: string | null;
  check_out_time?: string | null;
  phone?: string | null;
} | null;

export function guestFullName(
  c: { last_name: string | null; first_name: string | null } | null | undefined,
): string | null {
  return c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || null : null;
}

export function guideInput(
  r: GuideRow,
  facility: GuideFacility,
  registerUrl: string | null,
  lookupUrl: string | null = null,
): BookingGuideInput {
  return {
    guestName: guestFullName(r.customers),
    code: r.code,
    checkIn: r.check_in,
    checkOut: r.check_out,
    // 予約ごとに到着時刻が入っていればそれを優先する（施設の既定時刻は控え）
    checkInTime: (r.check_in_time ?? facility?.check_in_time ?? "15:00").slice(0, 5),
    checkOutTime: (facility?.check_out_time ?? "10:00").slice(0, 5),
    numGuests: r.num_guests,
    planName: r.plans?.name ?? null,
    // 失効・取消済みのPINを案内に載せない
    doorPin: r.access_keys?.status === "issued" ? r.access_keys.door_pin : null,
    registerUrl,
    lookupUrl,
    phone: facility?.phone ?? null,
  };
}
