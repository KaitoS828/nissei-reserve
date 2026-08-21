import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Discount, Facility, Plan } from "@/types/db";
import { ReserveCalendar } from "../../reserve/ReserveCalendar";

export const dynamic = "force-dynamic";

type FacilityWithSlug = Facility & {
  slug: string;
  public_site_enabled: boolean;
};

type PlanRow = Plan & {
  plan_prices: {
    price_per_night: number;
    guest_prices: Record<string, number> | null;
    room_type_id: string;
    room_types: { capacity: number; name: string } | null;
  }[];
};

export default async function FacilityReservePage({
  params,
}: {
  params: Promise<{ facilitySlug: string }>;
}) {
  const { facilitySlug } = await params;
  const supabase = createAdminClient();
  const { data: facilityData } = await supabase
    .from("facility")
    .select("*")
    .eq("slug", facilitySlug)
    .eq("status", "active")
    .eq("public_site_enabled", true)
    .maybeSingle();

  if (!facilityData) notFound();
  const facility = facilityData as FacilityWithSlug;

  const { data: planData } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, guest_prices, room_type_id, room_types(capacity,name))")
    .eq("facility_id", facility.id)
    .eq("is_active", true)
    .order("sort_order");

  const planRows = (planData ?? []) as unknown as PlanRow[];
  const roomTypeId = planRows[0]?.plan_prices[0]?.room_type_id ?? "";
  const roomType = planRows[0]?.plan_prices[0]?.room_types ?? null;
  const maxGuests = roomType?.capacity ?? 6;
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
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-400">施設</p>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">{facility.name}</h1>
        </div>
        <div>
          <p className="font-semibold text-gray-900">所在地</p>
          <p className="text-gray-600">{facility.address ?? "—"}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">お問い合わせ</p>
          <p className="text-gray-600">{facility.phone ?? "—"}</p>
        </div>
      </aside>

      <div>
        {roomTypeId ? (
          <ReserveCalendar
            plans={plans}
            roomTypeId={roomTypeId}
            maxGuests={maxGuests}
            roomLabel={roomType?.name ?? facility.name}
          />
        ) : (
          <p className="text-sm text-gray-500">現在ご予約いただけるプランがありません。</p>
        )}
      </div>
    </div>
  );
}
