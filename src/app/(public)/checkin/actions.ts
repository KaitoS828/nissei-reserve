"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import { jstStamp } from "@/lib/datetime";

// ドアPINは URL に載せない（共有・履歴・Referer に残るため）。
// 照会は GET ではなく Server Action で受けて、結果を state で返す。

export type CheckinState =
  | { status: "idle" }
  | { status: "error"; message: string; code: string; email: string }
  | {
      status: "ok";
      code: string;
      email: string;
      guestName: string;
      planName: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      numGuests: number;
      // キーパッドが実際に効かせている期間。施設の設定時刻ではなく鍵の実データ。
      validFrom: string | null;
      validUntil: string | null;
      doorPin: string | null;
      checkedIn: boolean;
      phone: string | null;
    };

// 予約の存在を推測されないよう、番号違いもメール違いも同じ文言にする。

type Loaded = {
  id: string;
  state: Extract<CheckinState, { status: "ok" }>;
};

async function load(code: string, email: string, locale: Locale): Promise<Loaded | string> {
  const t = dict(locale).checkin;
  const supabase = createAdminClient();
  const { data: resv } = await supabase
    .from("reservations")
    .select(
      "id, code, check_in, check_out, nights, num_guests, status, plans(name), customers(email, last_name, first_name), access_keys(door_pin, status, valid_from, valid_until)",
    )
    .eq("code", code)
    .maybeSingle();

  const cust = resv?.customers as unknown as
    | { email: string | null; last_name: string | null; first_name: string | null }
    | null;
  if (!resv || cust?.email?.trim().toLowerCase() !== email) return t.notFound;

  switch (resv.status) {
    case "cancelled":
      return t.cancelled;
    case "checked_out":
      return t.checkedOut;
    case "pending":
      return t.unpaid;
    case "no_show":
      return t.noShow;
  }

  const { data: facility } = await supabase
    .from("facility")
    .select("phone")
    .limit(1)
    .maybeSingle();

  // reservation_id に unique 制約があるため、埋め込みは配列でなく単一オブジェクト
  const key = resv.access_keys as unknown as
    | { door_pin: string; status: string; valid_from: string | null; valid_until: string | null }
    | null;
  const issued = key?.status === "issued" ? key : null;
  const name = [cust?.last_name, cust?.first_name].filter(Boolean).join(" ");

  return {
    id: resv.id as string,
    state: {
      status: "ok",
      code: resv.code as string,
      email,
      guestName: name || "お客様",
      planName: (resv.plans as unknown as { name: string } | null)?.name ?? "—",
      checkIn: resv.check_in as string,
      checkOut: resv.check_out as string,
      nights: (resv.nights as number | null) ?? 1,
      numGuests: resv.num_guests as number,
      validFrom: jstStamp(issued?.valid_from ?? null),
      validUntil: jstStamp(issued?.valid_until ?? null),
      doorPin: issued?.door_pin ?? null,
      checkedIn: resv.status === "checked_in",
      phone: (facility?.phone as string | null) ?? null,
    },
  };
}

export async function checkinAction(
  _prev: CheckinState,
  formData: FormData,
): Promise<CheckinState> {
  const code = String(formData.get("code") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const intent = String(formData.get("intent") ?? "verify");
  const raw = String(formData.get("locale") ?? "ja");
  const locale: Locale = isLocale(raw) ? raw : "ja";
  const t = dict(locale).checkin;

  if (!code || !email) {
    return { status: "error", message: t.notFound, code, email };
  }

  // 番号とメールの総当たりを止める
  const limited = rateLimit(`checkin:${await clientIp()}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return {
      status: "error",
      message: t.tooMany,
      code,
      email,
    };
  }

  const loaded = await load(code, email, locale);
  if (typeof loaded === "string") {
    return { status: "error", message: loaded, code, email };
  }

  if (intent !== "checkin" || loaded.state.checkedIn) return loaded.state;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "checked_in", updated_at: new Date().toISOString() })
    .eq("id", loaded.id);
  if (error) {
    return { status: "error", message: t.contactUs, code, email };
  }

  await auditLog(supabase, {
    action: "checkin",
    entityType: "reservation",
    entityId: loaded.id,
    summary: `${loaded.state.code} がチェックインしました（ゲスト操作）`,
  }).catch(() => {});

  return { ...loaded.state, checkedIn: true };
}
