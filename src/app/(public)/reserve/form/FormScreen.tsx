import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcPrice, nightlyRateForGuests, type Discount, type GuestPrices } from "@/lib/pricing";
import { eachNight } from "@/lib/availability";
import { dict, localePath, type Locale } from "@/lib/i18n";
import { startCheckout } from "./actions";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";
const label = "text-sm font-medium text-gray-900";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINS = ["00", "15", "30", "45"];

// 日英で同じ中身を出すための画面本体。
// カナ欄は日本語版のみ。海外のお客様は書けないので英語版では聞かない。
export async function FormScreen({
  planId,
  from,
  to,
  guests,
  error,
  errorNum,
  locale,
}: {
  planId?: string;
  from?: string;
  to?: string;
  guests?: string;
  error?: string;
  errorNum?: string;
  locale: Locale;
}) {
  if (!planId) notFound();

  const t = dict(locale).form;
  const r = dict(locale).reserve;

  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, guest_prices)")
    .eq("id", planId)
    .single();
  if (!plan) notFound();

  const pp = (plan.plan_prices ?? [])[0];
  const pricePerNight = pp?.price_per_night ?? 0;
  const numGuests = Math.max(1, Number(guests ?? 1) || 1);
  const nightly = nightlyRateForGuests(numGuests, pp?.guest_prices as GuestPrices, pricePerNight);
  const hasDates = from && to && eachNight(from, to).length >= 1;
  const price = hasDates ? calcPrice(from!, to!, nightly, (plan.discounts ?? []) as Discount[]) : null;

  const errorText = error
    ? error === "min_guests"
      ? t.errMinGuests(Number(errorNum) || 0)
      : (t.errors[error] ?? t.errors.generic)
    : null;

  const req = <span className="text-red-500">*</span>;

  return (
    <div className="space-y-6">
      <Link
        href={localePath(locale, `/reserve/${planId}`)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        {t.back}
      </Link>

      {/* 予約サマリ */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <h1 className="text-lg font-bold text-gray-900">{plan.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{r.roomLabel}</p>
        {price && (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-gray-200 pt-3">
            <p className="text-sm text-gray-600">{t.summary(from!, to!, price.nights, numGuests)}</p>
            <div className="ml-auto text-right">
              {price.discountRate > 0 && (
                <p className="text-xs text-gray-500 line-through">¥{price.subtotal.toLocaleString()}</p>
              )}
              <p className="text-xl font-bold text-gray-900">¥{price.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{t.taxIncl}</p>
              <p className="text-sm text-gray-500">
                {r.perPersonTotal(Math.round(price.total / numGuests).toLocaleString())}
              </p>
            </div>
          </div>
        )}
      </div>

      {errorText && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorText}</p>
      )}

      <form action={startCheckout} className="space-y-6">
        <input type="hidden" name="plan" value={planId} />
        <input type="hidden" name="from" value={from ?? ""} />
        <input type="hidden" name="to" value={to ?? ""} />
        <input type="hidden" name="guests" value={guests ?? "1"} />
        <input type="hidden" name="locale" value={locale} />

        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.name} {req}</span>
            <div className="flex gap-2">
              <input name="last_name" placeholder={t.lastName} required className={field} />
              <input name="first_name" placeholder={t.firstName} required className={field} />
            </div>
          </div>
          {locale === "ja" && (
            <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
              <span className={label}>{t.nameKana} {req}</span>
              <div className="flex gap-2">
                <input name="last_name_kana" placeholder={t.lastNameKana} required className={field} />
                <input name="first_name_kana" placeholder={t.firstNameKana} required className={field} />
              </div>
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.email} {req}</span>
            <input type="email" name="email" placeholder="abcde@example.com" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.emailConfirm} {req}</span>
            <input type="email" name="email2" placeholder="abcde@example.com" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.phone} {req}</span>
            <input name="phone" placeholder={t.phonePlaceholder} required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.prefecture} {req}</span>
            <input name="prefecture" placeholder={t.prefecturePlaceholder} required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.city} {req}</span>
            <input name="city" placeholder={t.cityPlaceholder} required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.address} {req}</span>
            <div>
              <input name="address" placeholder={t.addressPlaceholder} required className={field} />
              {t.addressHint && <p className="mt-1 text-xs text-gray-500">{t.addressHint}</p>}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.building}</span>
            <input name="building" placeholder={t.buildingPlaceholder} className={field} />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>{t.checkInTime} {req}</span>
            <div className="flex items-center gap-2">
              <select name="ci_hour" required defaultValue="15" className={`${field} w-24`}>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span>:</span>
              <select name="ci_min" required defaultValue="00" className={`${field} w-24`}>
                {MINS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div className="grid gap-2 md:grid-cols-[160px_1fr]">
            <span className={label}>{t.survey}</span>
            <textarea name="survey" rows={3} placeholder={t.surveyPlaceholder} className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr]">
            <span className={label}>{t.contact}</span>
            <textarea name="contact" rows={3} placeholder={t.contactPlaceholder} className={field} />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="agree_policy" required className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t.agreePolicy.before}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline hover:text-teal-500">
              {t.agreePolicy.linkText}
            </Link>
            {t.agreePolicy.after} {req}
          </span>
        </label>

        <div className="flex justify-center">
          <SubmitButton pendingLabel={t.submitting} className="rounded-full bg-teal-600 px-12 py-3 font-medium text-white transition hover:bg-teal-500">
            {t.submit}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
