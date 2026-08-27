import { createAdminClient } from "@/lib/supabase/admin";
import { dict, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import type { Plan, Facility, Discount } from "@/types/db";
import { ReserveCalendar } from "./ReserveCalendar";
import { ImageLightbox } from "@/components/ImageLightbox";

type FacilitySettings = {
  hero_title?: string;
  hero_sub?: string;
  hero_description?: string;
  hero_images?: unknown;
  features?: unknown;
};

type PlanRow = Plan & {
  plan_prices: {
    price_per_night: number;
    guest_prices: Record<string, number> | null;
    room_type_id: string;
    room_types: { capacity: number } | null;
  }[];
};

// 日英で同じ中身を出すための画面本体。
// page.tsx は任意のプロパティを受け取れないので、部品側に切り出している。
export async function ReserveScreen({
  locale,
  from,
  to,
  guests,
}: {
  locale: Locale;
  /** URLパラメータでの日付事前入力(?from=YYYY-MM-DD&to=YYYY-MM-DD&guests=N)。妥当性はReserveCalendar側で検証する。 */
  from?: string;
  to?: string;
  guests?: string;
}) {
  const t = dict(locale).reserve;
  const supabase = createAdminClient();
  const [{ data: planData }, { data: facilityData }] = await Promise.all([
    supabase
      .from("plans")
      .select("*, plan_prices(price_per_night, guest_prices, room_type_id, room_types(capacity))")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("facility").select("*").limit(1).single(),
  ]);

  const planRows = (planData ?? []) as unknown as PlanRow[];
  const facility = (facilityData ?? null) as Facility | null;
  const settings = (facility?.settings as FacilitySettings) ?? {};
  const heroImages = Array.isArray(settings.hero_images) ? (settings.hero_images as string[]) : [];
  const features = Array.isArray(settings.features) ? (settings.features as string[]) : [];

  const roomTypeId = planRows[0]?.plan_prices[0]?.room_type_id ?? "";
  const maxGuests = planRows[0]?.plan_prices[0]?.room_types?.capacity ?? 6;
  const plans = planRows.map((p) => ({
    id: p.id,
    name: p.name,
    tags: (p.tags ?? []) as string[],
    pricePerNight: p.plan_prices[0]?.price_per_night ?? 0,
    guestPrices: p.plan_prices[0]?.guest_prices ?? null,
    discounts: (p.discounts ?? []) as Discount[],
    galleryImages: p.gallery_images ?? [],
  }));

  return (
    <div className="space-y-6">
      {locale === "ja" && (settings.hero_title || settings.hero_sub || settings.hero_description) && (
        <section className="relative space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
          <span className="absolute right-4 top-4 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 sm:right-6 sm:top-6">
            7泊以上で最大15%OFF
          </span>
          <div className="space-y-2 border-b border-gray-100 pb-4">
            {settings.hero_sub && (
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {settings.hero_sub}
              </span>
            )}
            {settings.hero_title && (
              <h1 className="font-serif text-2xl font-bold tracking-widest text-gray-900">
                {settings.hero_title}
              </h1>
            )}
            {settings.hero_description && (
              <p className="whitespace-pre-wrap text-sm font-light leading-relaxed text-gray-600">
                {settings.hero_description}
              </p>
            )}
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {features.map((f, i) => (
                  <span
                    key={i}
                    className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ImageLightbox images={heroImages} altPrefix={SITE.name} visibleCount={4} />
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside className="order-last space-y-3 text-sm md:order-none">
          <div>
            <p className="font-semibold text-gray-900">{t.location}</p>
            <p className="text-gray-600">
              {locale === "en" ? SITE.address.fullEn : (facility?.address ?? "—")}
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{t.contact}</p>
            <p className="text-gray-600">{facility?.phone ?? "—"}</p>
          </div>
        </aside>

        <div>
          {roomTypeId ? (
            <ReserveCalendar
              plans={plans}
              roomTypeId={roomTypeId}
              maxGuests={maxGuests}
              locale={locale}
              initialFrom={from}
              initialTo={to}
              initialGuests={guests}
            />
          ) : (
            <p className="text-sm text-gray-500">{t.noPlans}</p>
          )}
        </div>
      </div>
    </div>
  );
}
