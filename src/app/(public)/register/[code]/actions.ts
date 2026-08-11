"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { uploadPassportImage } from "@/lib/passport-storage";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (formData: FormData, key: string) => str(formData, key) || null;

function back(code: string, msg: string): never {
  redirect(`/register/${code}?error=${encodeURIComponent(msg)}`);
}

export async function submitGuestRegistration(formData: FormData) {
  const code = str(formData, "secret_code");
  if (!code) redirect("/");

  const limited = rateLimit(`register:${await clientIp()}`, 30, 10 * 60_000);
  if (!limited.ok) back(code, "送信が続いています。しばらく経ってからお試しください。");

  const count = Math.max(1, Number(formData.get("guest_count") ?? 1));

  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("reservation_checkins")
    .select("reservation_id")
    .eq("secret_code", code)
    .maybeSingle();
  if (!checkin) back(code, "ご予約が見つかりません");
  const reservationId = checkin.reservation_id as string;

  // 全員分をまとめて受け取る。1件でも不備があれば、何も保存せず入力画面に戻す。
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= count; i++) {
    const fullName = str(formData, `full_name_${i}`);
    const address = str(formData, `address_${i}`);
    const contact = str(formData, `contact_${i}`);

    // 後半の方をまだ入力していない場合は、そこまでを保存して終える
    if (!fullName && !address && !contact) continue;
    if (!fullName || !address || !contact) {
      back(code, `${i}人目の氏名・住所・連絡先をご記入ください`);
    }

    const isForeign = formData.get(`is_foreign_national_${i}`) === "on";
    const nationality = nullable(formData, `nationality_${i}`);
    const passportNumber = nullable(formData, `passport_number_${i}`);
    if (isForeign && (!nationality || !passportNumber)) {
      back(code, `${i}人目の国籍と旅券番号をご記入ください`);
    }

    // 旅券の写しは非公開バケットへ。保存するのはパスだけで、公開URLは作らない。
    const file = formData.get(`passport_image_${i}`);
    let passportPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const up = await uploadPassportImage(supabase, file, reservationId, i);
      if (!up.ok) back(code, `${i}人目の旅券の写し: ${up.reason}`);
      passportPath = up.path;
    }

    rows.push({
      guest_order: i,
      full_name: fullName,
      address,
      contact,
      occupation: nullable(formData, `occupation_${i}`),
      gender: nullable(formData, `gender_${i}`),
      birth_date: nullable(formData, `birth_date_${i}`),
      is_foreign_national: isForeign,
      nationality,
      passport_number: passportNumber,
      ...(passportPath ? { passport_image_url: passportPath } : {}),
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) back(code, "少なくとも1人分のご記入をお願いいたします");

  const { error } = await supabase
    .from("reservation_guests")
    .upsert(
      rows.map((r) => ({ ...r, reservation_id: reservationId })),
      { onConflict: "reservation_id,guest_order" },
    );
  if (error) back(code, error.message);

  await supabase
    .from("reservation_checkins")
    .update({
      status: "pre_registered",
      pre_registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("reservation_id", reservationId);

  redirect(`/register/${code}?done=${rows.length}`);
}
