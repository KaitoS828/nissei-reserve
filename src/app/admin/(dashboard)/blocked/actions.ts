"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultFacilityId } from "@/lib/facility";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/blocked";

export async function createBlocked(formData: FormData) {
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "休業";

  if (!start || !end) redirect(`${PATH}?error=${encodeURIComponent("開始日・終了日は必須です")}`);
  if (end < start) redirect(`${PATH}?error=${encodeURIComponent("終了日は開始日以降にしてください")}`);

  const supabase = createAdminClient();
  const facilityId = await getDefaultFacilityId(supabase);
  const { error } = await supabase.from("blocked_dates").insert({
    facility_id: facilityId,
    start_date: start,
    end_date: end,
    reason,
  });
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await auditLog(supabase, {
    action: "blocked.create",
    entityType: "blocked_dates",
    summary: `${start}〜${end} を予約不可に設定（${reason}）`,
    metadata: { start, end, reason },
  });
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

export async function deleteBlocked(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  // 何を消したか残すため、削除前に対象を控える
  const { data: target } = await supabase
    .from("blocked_dates")
    .select("start_date, end_date, reason")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("blocked_dates").delete().eq("id", id);
  await auditLog(supabase, {
    action: "blocked.delete",
    entityType: "blocked_dates",
    entityId: id,
    summary: target
      ? `${target.start_date}〜${target.end_date} の予約不可を解除`
      : "予約不可を解除",
    metadata: target ?? {},
  });
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
}

function shiftDay(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** カレンダーの1日分を予約不可 ⇄ 予約可 で切り替える。
 *  期間の途中を解除した場合は、その期間を前後に分割する。 */
export async function toggleBlockedDate(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const back = String(formData.get("redirect_to") ?? "/admin/calendar");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("日付が不正です")}`);
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blocked_dates")
    .select("id, start_date, end_date, reason")
    .is("room_type_id", null)
    .lte("start_date", date)
    .gte("end_date", date);
  const covering = (data ?? []) as {
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
  }[];

  let error: { message: string } | null = null;

  if (covering.length === 0) {
    const facilityId = await getDefaultFacilityId(supabase);
    ({ error } = await supabase.from("blocked_dates").insert({
      facility_id: facilityId,
      start_date: date,
      end_date: date,
      reason: "休業",
    }));
  } else {
    for (const b of covering) {
      if (b.start_date === date && b.end_date === date) {
        ({ error } = await supabase.from("blocked_dates").delete().eq("id", b.id));
      } else if (b.start_date === date) {
        ({ error } = await supabase
          .from("blocked_dates")
          .update({ start_date: shiftDay(date, 1) })
          .eq("id", b.id));
      } else if (b.end_date === date) {
        ({ error } = await supabase
          .from("blocked_dates")
          .update({ end_date: shiftDay(date, -1) })
          .eq("id", b.id));
      } else {
        // 期間の途中 → 前半を縮めて、後半を新しい行として作り直す
        ({ error } = await supabase
          .from("blocked_dates")
          .update({ end_date: shiftDay(date, -1) })
          .eq("id", b.id));
        if (!error) {
          const facilityId = await getDefaultFacilityId(supabase);
          ({ error } = await supabase.from("blocked_dates").insert({
            facility_id: facilityId,
            start_date: shiftDay(date, 1),
            end_date: b.end_date,
            reason: b.reason,
          }));
        }
      }
      if (error) break;
    }
  }

  if (error) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
  }
  const blocked = covering.length === 0;
  await auditLog(supabase, {
    action: blocked ? "blocked.create" : "blocked.delete",
    entityType: "blocked_dates",
    summary: `${date} を${blocked ? "予約不可に設定" : "予約可に戻した"}（カレンダー）`,
    metadata: { date },
  });
  revalidatePath(PATH);
  revalidatePath("/admin/calendar");
  redirect(back);
}
