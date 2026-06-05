import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan, Facility, Discount } from "@/types/db";
import { ReserveCalendar } from "./ReserveCalendar";

export const dynamic = "force-dynamic";

type PlanRow = Plan & {
  plan_prices: {
    price_per_night: number;
    guest_prices: Record<string, number> | null;
    room_type_id: string;
    room_types: { capacity: number } | null;
  }[];
};

export default async function ReservePage() {
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

  const roomTypeId = planRows[0]?.plan_prices[0]?.room_type_id ?? "";
  const maxGuests = planRows[0]?.plan_prices[0]?.room_types?.capacity ?? 6;
  const plans = planRows.map((p) => ({
    id: p.id,
    name: p.name,
    tags: (p.tags ?? []) as string[],
    pricePerNight: p.plan_prices[0]?.price_per_night ?? 0,
    guestPrices: p.plan_prices[0]?.guest_prices ?? null,
    discounts: (p.discounts ?? []) as Discount[],
  }));

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-gray-900">所在地</p>
          <p className="text-gray-600">{facility?.address ?? "—"}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">お問い合わせ</p>
          <p className="text-gray-600">{facility?.phone ?? "—"}</p>
        </div>
      </aside>

      <div>
        {roomTypeId ? (
          <ReserveCalendar plans={plans} roomTypeId={roomTypeId} maxGuests={maxGuests} />
        ) : (
          <p className="text-sm text-gray-500">現在ご予約いただけるプランがありません。</p>
        )}
      </div>
    </div>
  );
}
