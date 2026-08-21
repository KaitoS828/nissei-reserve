import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTypeAvailability } from "@/lib/reservations";
import { eachNight } from "@/lib/availability";
import { calcPrice, guestRange, nightlyRateForGuests, type GuestPrices } from "@/lib/pricing";
import { dict, localePath, term, type Locale } from "@/lib/i18n";
import type { Plan, RoomType } from "@/types/db";
import { ImageLightbox } from "@/components/ImageLightbox";

type PlanDetail = Plan & {
  plan_prices: {
    price_per_night: number;
    guest_prices: Record<string, number> | null;
    room_type_id: string;
    room_types: Pick<RoomType, "id" | "name" | "amenities" | "capacity"> | null;
  }[];
};

// 日英で同じ中身を出すための画面本体。
// プラン名・紹介文・アメニティは DB に日本語しか無いので、英語ページでも
// そのまま出す。英語版では「ここは日本語です」と断りを入れる。
export async function PlanScreen({
  planId,
  from,
  to,
  guests,
  locale,
}: {
  planId: string;
  from?: string;
  to?: string;
  guests?: string;
  locale: Locale;
}) {
  const t = dict(locale).plan;
  const r = dict(locale).reserve;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, guest_prices, room_type_id, room_types(id,name,amenities,capacity))")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (!data) notFound();
  const plan = data as PlanDetail;
  const pp = plan.plan_prices[0];
  const pricePerNight = pp?.price_per_night ?? 0;
  const roomType = pp?.room_types ?? null;
  const amenities = (roomType?.amenities ?? []) as string[];
  const { min: minGuests, max: maxGuests } = guestRange(
    pp?.guest_prices as GuestPrices,
    roomType?.capacity ?? 6,
  );
  const numGuests = Math.min(maxGuests, Math.max(minGuests, Number(guests ?? minGuests) || minGuests));

  // 日程が指定されていれば空室・料金を算出
  let available: boolean | null = null;
  let price = null as ReturnType<typeof calcPrice> | null;
  const validDates = from && to && eachNight(from, to).length >= 1;
  if (validDates && roomType) {
    const avail = await getTypeAvailability(roomType.id, from!, to!);
    available = eachNight(from!, to!).every((n) => (avail[n] ?? 0) > 0);
    const nightly = nightlyRateForGuests(numGuests, pp?.guest_prices as GuestPrices, pricePerNight);
    price = calcPrice(from!, to!, nightly, plan.discounts);
  }

  const formQuery = new URLSearchParams();
  formQuery.set("plan", plan.id);
  if (from) formQuery.set("from", from);
  if (to) formQuery.set("to", to);
  formQuery.set("guests", String(numGuests));

  return (
    <div className="space-y-6">
      <Link
        href={localePath(locale, "/reserve")}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        {t.backHome}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{r.roomLabel}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.tags.map((tag) => (
            <span key={tag} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500">
              {term(locale, tag)}
            </span>
          ))}
        </div>
        {plan.gallery_images.length > 0 && (
          <div className="mt-4">
            <ImageLightbox images={plan.gallery_images} altPrefix={plan.name} />
          </div>
        )}
      </div>

      {/* 予約バー */}
      <form method="get" className="rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full grid-cols-2 gap-3 sm:contents">
            <label className="min-w-0 space-y-1 sm:min-w-[8.5rem] sm:flex-none">
              <span className="text-xs text-gray-500">{t.checkIn}</span>
              <input type="date" name="from" defaultValue={from} className="block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="min-w-0 space-y-1 sm:min-w-[8.5rem] sm:flex-none">
              <span className="text-xs text-gray-500">{t.checkOut}</span>
              <input type="date" name="to" defaultValue={to} className="block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">{t.guestsRange(minGuests, maxGuests)}</span>
            <input type="number" name="guests" min={minGuests} max={maxGuests} defaultValue={String(numGuests)} className="block w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            {t.checkAvailability}
          </button>

          <div className="flex w-full items-center justify-between gap-4 sm:ml-auto sm:w-auto sm:justify-end">
            {price && (
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">¥{price.total.toLocaleString()}</p>
                <p className="text-xs text-gray-500">
                  {r.nightsTaxIncl(price.nights)}
                  {price.discountRate > 0 && r.longStayApplied(Math.round(price.discountRate * 100))}
                </p>
                <p className="text-sm text-gray-500">
                  {r.perPersonTotal(Math.round(price.total / numGuests).toLocaleString())}
                </p>
              </div>
            )}
            {available === false ? (
              <span className="rounded-full bg-red-50 px-6 py-2.5 text-sm font-medium text-red-600">{t.full}</span>
            ) : validDates && available ? (
              <Link href={`${localePath(locale, "/reserve/form")}?${formQuery.toString()}`} className="rounded-full bg-teal-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500">
                {t.book}
              </Link>
            ) : (
              <span className="rounded-full bg-gray-200 px-8 py-2.5 text-sm font-medium text-gray-500">{r.selectDates}</span>
            )}
          </div>
        </div>
        {available && (
          <p className="mt-2 text-sm text-teal-700">{t.available}</p>
        )}
      </form>

      {/* プラン紹介 */}
      <section className="rounded-2xl border border-gray-200 p-6 shadow-sm">
        {t.contentInJapanese && (
          <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{t.contentInJapanese}</p>
        )}

        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t.aboutPlan}</h2>
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700" lang="ja">
          {plan.long_description ?? plan.description}
        </p>

        <hr className="my-6 border-gray-100" />

        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t.aboutRoom}</h2>
        <p className="text-sm text-gray-700">{roomType?.name ?? r.roomLabel}</p>

        <p className="mt-4 text-sm font-semibold text-gray-900">{t.roomFeatures}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {t.features.map((f) => (
            <span key={f}>✓ {f}</span>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-900">{t.amenities}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {amenities.map((a) => (
            <span key={a}>✓ {term(locale, a)}</span>
          ))}
        </div>

        {plan.discounts.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold text-gray-900">{t.longStay}</p>
            <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
              {plan.discounts.map((d, i) => (
                <li key={i}>{t.discountLine(d.min, d.max ?? null, Math.round(d.rate * 100))}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
