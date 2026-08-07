"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

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
const NOT_FOUND = "予約が見つかりませんでした。予約番号とメールアドレスをご確認ください。";

/** UTC の timestamptz を「YYYY-MM-DD HH:MM」(JST) にする。 */
function jst(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

type Loaded = {
  id: string;
  state: Extract<CheckinState, { status: "ok" }>;
};

async function load(code: string, email: string): Promise<Loaded | string> {
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
  if (!resv || cust?.email?.trim().toLowerCase() !== email) return NOT_FOUND;

  switch (resv.status) {
    case "cancelled":
      return "この予約はキャンセルされています。";
    case "checked_out":
      return "チェックアウト済みの予約です。";
    case "pending":
      return "決済の確認が取れていません。しばらく経ってから再度お試しください。";
    case "no_show":
      return "この予約はご利用いただけません。宿までお問い合わせください。";
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
      validFrom: jst(issued?.valid_from ?? null),
      validUntil: jst(issued?.valid_until ?? null),
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

  if (!code || !email) {
    return { status: "error", message: "予約番号とメールアドレスを入力してください。", code, email };
  }

  // 番号とメールの総当たりを止める
  const limited = rateLimit(`checkin:${await clientIp()}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return {
      status: "error",
      message: `試行回数が多すぎます。${Math.ceil(limited.retryAfterSec / 60)}分ほど経ってからお試しください。`,
      code,
      email,
    };
  }

  const loaded = await load(code, email);
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
    return { status: "error", message: "チェックインの記録に失敗しました。宿までご連絡ください。", code, email };
  }

  await auditLog(supabase, {
    action: "checkin",
    entityType: "reservation",
    entityId: loaded.id,
    summary: `${loaded.state.code} がチェックインしました（ゲスト操作）`,
  }).catch(() => {});

  return { ...loaded.state, checkedIn: true };
}
