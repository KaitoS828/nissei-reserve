// 旅券画像の保管。氏名・旅券番号と結びつく機微な個人情報なので、
// 公開バケットには置かない。非公開バケットに入れ、閲覧は都度の署名付きURLで行う。

import type { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const PASSPORT_BUCKET = "passports";
export const PASSPORT_MAX_BYTES = 10 * 1024 * 1024;
export const PASSPORT_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type UploadResult = { ok: true; path: string } | { ok: false; reason: string };

function extensionFor(type: string, name: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadPassportImage(
  supabase: AdminClient,
  file: File,
  reservationId: string,
  guestOrder: number,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, reason: "ファイルが空です" };
  if (file.size > PASSPORT_MAX_BYTES) {
    return { ok: false, reason: "ファイルサイズは10MBまでにしてください" };
  }
  if (!PASSPORT_MIME.includes(file.type)) {
    return { ok: false, reason: "JPEG・PNG・WebP・PDF のいずれかをお選びください" };
  }

  const path = `${reservationId}/${guestOrder}-${Date.now()}.${extensionFor(file.type, file.name)}`;
  const { error } = await supabase.storage
    .from(PASSPORT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { ok: false, reason: error.message };

  // 公開URLは作らない。保存するのはバケット内のパスだけ。
  return { ok: true, path };
}

/** 管理画面で開くための一時URL。既定は5分で失効する。 */
export async function signedPassportUrl(
  supabase: AdminClient,
  path: string,
  expiresInSec = 300,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(PASSPORT_BUCKET)
    .createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}
