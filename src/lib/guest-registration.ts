// 宿泊者名簿（旅館業法）の記入まわり。
// 予約ごとに推測できない secret_code を1つ持たせ、その URL でフォームを開く。
// lookup_token は Web 予約にしか入らないため、手動予約でも使えるこちらを使う。

import crypto from "crypto";
import type { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export function newSecretCode(): string {
  // URL に載るので記号を含まない形にする
  return crypto.randomBytes(16).toString("hex");
}

/** 予約の secret_code を返す。無ければ作る。 */
export async function ensureSecretCode(
  supabase: AdminClient,
  reservationId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("reservation_checkins")
    .select("secret_code")
    .eq("reservation_id", reservationId)
    .maybeSingle();
  if (existing?.secret_code) return existing.secret_code as string;

  const secret = newSecretCode();
  const { error } = await supabase
    .from("reservation_checkins")
    .insert({ reservation_id: reservationId, secret_code: secret });
  if (error) {
    // 同時に作られた場合は相手の値を使う
    const { data: retry } = await supabase
      .from("reservation_checkins")
      .select("secret_code")
      .eq("reservation_id", reservationId)
      .maybeSingle();
    return (retry?.secret_code as string | undefined) ?? null;
  }
  return secret;
}

export function registerUrl(origin: string, secretCode: string | null): string | null {
  return secretCode ? `${origin.replace(/\/$/, "")}/register/${secretCode}` : null;
}
