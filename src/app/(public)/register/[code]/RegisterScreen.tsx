import { createAdminClient } from "@/lib/supabase/admin";
import { RegisterForm, type ExistingGuest } from "./RegisterForm";
import { dict, type Locale } from "@/lib/i18n";

// 日英で同じ中身を出すための画面本体。
export async function RegisterScreen({
  code,
  error,
  done,
  locale,
}: {
  code: string;
  error?: string;
  done?: string;
  locale: Locale;
}) {
  const t = dict(locale).register;
  const c = dict(locale).common;

  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("reservation_checkins")
    .select("reservation_id, reservations(code, check_in, check_out, num_guests, status)")
    .eq("secret_code", code)
    .maybeSingle();

  const resv = checkin?.reservations as unknown as
    | { code: string; check_in: string; check_out: string; num_guests: number; status: string }
    | null;

  if (!checkin || !resv || resv.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{t.invalidUrl}</p>
      </div>
    );
  }

  const { data: guestsData } = await supabase
    .from("reservation_guests")
    .select(
      "guest_order, full_name, furigana, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url",
    )
    .eq("reservation_id", checkin.reservation_id)
    .order("guest_order");
  const guests = (guestsData ?? []) as ExistingGuest[];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-2 text-sm text-gray-600">{t.lead}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{c.reservationCode}</span>
          <span className="font-mono text-gray-900">{resv.code}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">{c.dates}</span>
          <span className="text-gray-900">
            {resv.check_in} 〜 {resv.check_out}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">{t.status}</span>
          <span className={guests.length >= resv.num_guests ? "text-teal-700" : "text-gray-900"}>
            {guests.length} / {resv.num_guests}
          </span>
        </div>
      </div>

      {done && (
        <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {done} {t.done}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <RegisterForm
        secretCode={code}
        numGuests={resv.num_guests}
        existing={guests}
        locale={locale}
      />
    </div>
  );
}
