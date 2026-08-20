"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { uploadPassportImage } from "@/lib/passport-storage";
import { dict, isLocale, type Locale } from "@/lib/i18n";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (formData: FormData, key: string) => str(formData, key) || null;

function back(code: string, msg: string, locale: Locale = "ja"): never {
  const base = locale === "en" ? "/en/register" : "/register";
  redirect(`${base}/${code}?error=${encodeURIComponent(msg)}`);
}

export async function submitGuestRegistration(formData: FormData) {
  const code = str(formData, "secret_code");
  if (!code) redirect("/");

  const rawLocale = String(formData.get("locale") ?? "ja");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ja";
  const t = dict(locale).register;

  const limited = rateLimit(`register:${await clientIp()}`, 30, 10 * 60_000);
  if (!limited.ok) back(code, dict(locale).checkin.tooMany, locale);

  const count = Math.max(1, Number(formData.get("guest_count") ?? 1));

  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("reservation_checkins")
    .select("reservation_id")
    .eq("secret_code", code)
    .maybeSingle();
  if (!checkin) back(code, t.invalidUrl, locale);
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
      back(code, `${t.person} ${i}: ${t.errName} / ${t.errAddress} / ${t.errContact}`, locale);
    }

    const isForeign = formData.get(`is_foreign_national_${i}`) === "on";
    const nationality = nullable(formData, `nationality_${i}`);
    const passportNumber = nullable(formData, `passport_number_${i}`);
    if (isForeign && (!nationality || !passportNumber)) {
      back(code, `${t.person} ${i}: ${t.errNationality} / ${t.errPassportNo}`, locale);
    }

    // 旅券の写しは非公開バケットへ。保存するのはパスだけで、公開URLは作らない。
    const file = formData.get(`passport_image_${i}`);
    let passportPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const up = await uploadPassportImage(supabase, file, reservationId, i);
      if (!up.ok) back(code, `${t.person} ${i}: ${up.reason}`, locale);
      passportPath = up.path;
    }

    rows.push({
      guest_order: i,
      full_name: fullName,
      furigana: nullable(formData, `furigana_${i}`),
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

  if (rows.length === 0) back(code, t.errAtLeastOne, locale);

  const { error } = await supabase
    .from("reservation_guests")
    .upsert(
      rows.map((r) => ({ ...r, reservation_id: reservationId })),
      { onConflict: "reservation_id,guest_order" },
    );
  if (error) back(code, error.message, locale);

  await supabase
    .from("reservation_checkins")
    .update({
      status: "pre_registered",
      pre_registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("reservation_id", reservationId);

  redirect(`${locale === "en" ? "/en/register" : "/register"}/${code}?done=${rows.length}`);
}
