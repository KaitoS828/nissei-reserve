// 空室算出ロジック (design.md §6.3)
// ある room_type の日付D(=1泊)の空き =
//   active な rooms数(該当type)
//   − status in (pending/confirmed/checked_in) で D を含む reservations数
//   − D を含む blocked_dates数
// 宿泊は「泊」単位。チェックアウト日は在庫を消費しない（check_in <= D < check_out）。

export type DateStr = string; // "YYYY-MM-DD"

export const OCCUPYING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
] as const;

function toDate(d: DateStr): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fmt(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

// [from, to) の各泊の日付を返す（to は含まない＝チェックアウト日）
export function eachNight(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const end = toDate(to);
  for (let d = toDate(from); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(fmt(d));
  }
  return out;
}

// 1泊 D が予約で埋まっているか: check_in <= D < check_out
function reservationCoversNight(
  r: { check_in: DateStr; check_out: DateStr },
  night: DateStr,
): boolean {
  return r.check_in <= night && night < r.check_out;
}

// 1泊 D が休業か: start_date <= D <= end_date（両端含む）
function blockedCoversNight(
  b: { start_date: DateStr; end_date: DateStr },
  night: DateStr,
): boolean {
  return b.start_date <= night && night <= b.end_date;
}

export type AvailabilityInput = {
  roomCount: number;
  reservations: { check_in: DateStr; check_out: DateStr }[];
  blocked: { start_date: DateStr; end_date: DateStr }[];
  from: DateStr;
  to: DateStr;
};

// 各泊の空き室数（0 未満は 0 に丸め）を返す
export function computeAvailability(
  input: AvailabilityInput,
): Record<DateStr, number> {
  const result: Record<DateStr, number> = {};
  for (const night of eachNight(input.from, input.to)) {
    const reserved = input.reservations.filter((r) =>
      reservationCoversNight(r, night),
    ).length;
    const blocked = input.blocked.some((b) => blockedCoversNight(b, night))
      ? input.roomCount
      : 0;
    result[night] = Math.max(0, input.roomCount - reserved - blocked);
  }
  return result;
}

// 滞在期間 [from, to) が全泊予約可能か
export function isStayAvailable(input: AvailabilityInput): boolean {
  const avail = computeAvailability(input);
  return eachNight(input.from, input.to).every((n) => (avail[n] ?? 0) > 0);
}
