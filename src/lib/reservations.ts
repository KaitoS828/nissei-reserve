import { createAdminClient } from "./supabase/admin";
import {
  computeAvailability,
  eachNight,
  OCCUPYING_STATUSES,
  type DateStr,
} from "./availability";

// 人間可読な予約番号（例: R-20260601-A1B2）
export function generateReservationCode(checkIn: DateStr): string {
  const ymd = checkIn.replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R-${ymd}-${rand}`;
}

// 指定 room_type の [from, to) 各泊の空き室数を返す
export async function getTypeAvailability(
  roomTypeId: string,
  from: DateStr,
  to: DateStr,
  opts: { excludeReservationId?: string } = {},
): Promise<Record<DateStr, number>> {
  const supabase = createAdminClient();

  const [roomsRes, reservationsRes, blockedRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("room_type_id", roomTypeId)
      .eq("is_active", true),
    supabase
      .from("reservations")
      .select("id, check_in, check_out")
      .eq("room_type_id", roomTypeId)
      .in("status", OCCUPYING_STATUSES as unknown as string[])
      .is("archived_at", null)
      .lt("check_in", to)
      .gt("check_out", from),
    supabase
      .from("blocked_dates")
      .select("start_date, end_date, room_type_id")
      .or(`room_type_id.eq.${roomTypeId},room_type_id.is.null`)
      .lte("start_date", to)
      .gte("end_date", from),
  ]);

  const roomCount = roomsRes.count ?? 0;
  const reservations = (reservationsRes.data ?? []).filter(
    (r) => r.id !== opts.excludeReservationId,
  );
  const blocked = blockedRes.data ?? [];

  return computeAvailability({ roomCount, reservations, blocked, from, to });
}

// 滞在 [from,to) が全泊空いているか
export async function canBook(
  roomTypeId: string,
  from: DateStr,
  to: DateStr,
  opts: { excludeReservationId?: string } = {},
): Promise<boolean> {
  const avail = await getTypeAvailability(roomTypeId, from, to, opts);
  return eachNight(from, to).every((n) => (avail[n] ?? 0) > 0);
}
