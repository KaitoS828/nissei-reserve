"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (formData: FormData, key: string) => value(formData, key) || null;

function back(code: string, msg: string): never {
  redirect(`/register/${code}?error=${encodeURIComponent(msg)}`);
}

export async function submitGuestRegistration(formData: FormData) {
  const code = value(formData, "secret_code");
  if (!code) redirect("/");

  const limited = rateLimit(`register:${await clientIp()}`, 30, 10 * 60_000);
  if (!limited.ok) back(code, "送信が続いています。しばらく経ってからお試しください。");

  const fullName = value(formData, "full_name");
  const address = value(formData, "address");
  const contact = value(formData, "contact");
  if (!fullName || !address || !contact) {
    back(code, "氏名・住所・連絡先は必須です");
  }

  const isForeign = formData.get("is_foreign_national") === "on";
  const nationality = nullable(formData, "nationality");
  const passportNumber = nullable(formData, "passport_number");
  // 国内に住所を持たない外国籍の方は国籍と旅券番号の記載が要る
  if (isForeign && (!nationality || !passportNumber)) {
    back(code, "海外にお住まいの方は国籍と旅券番号をご記入ください");
  }

  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("reservation_checkins")
    .select("reservation_id")
    .eq("secret_code", code)
    .maybeSingle();
  if (!checkin) back(code, "ご予約が見つかりません");

  const guestOrder = Math.max(1, Number(formData.get("guest_order") ?? 1));

  const { error } = await supabase.from("reservation_guests").upsert(
    {
      reservation_id: checkin.reservation_id,
      guest_order: guestOrder,
      full_name: fullName,
      address,
      contact,
      occupation: nullable(formData, "occupation"),
      gender: nullable(formData, "gender"),
      birth_date: nullable(formData, "birth_date"),
      is_foreign_national: isForeign,
      nationality,
      passport_number: passportNumber,
      updated_at: new Date().toISOString(),
    },
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
    .eq("reservation_id", checkin.reservation_id);

  redirect(`/register/${code}?done=${guestOrder}`);
}
