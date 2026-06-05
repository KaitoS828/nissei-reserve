import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTypeAvailability } from "@/lib/reservations";
import { eachNight } from "@/lib/availability";
import { calcPrice } from "@/lib/pricing";
import type { Plan, RoomType } from "@/types/db";

export const dynamic = "force-dynamic";

type PlanDetail = Plan & {
  plan_prices: {
    price_per_night: number;
    room_type_id: string;
    room_types: Pick<RoomType, "id" | "name" | "amenities" | "capacity"> | null;
  }[];
};

const ROOM_FEATURES = ["無料WiFi", "洗浄機付トイレ"];

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ from?: string; to?: string; guests?: string }>;
}) {
  const { planId } = await params;
  const { from, to, guests } = await searchParams;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night, room_type_id, room_types(id,name,amenities,capacity))")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (!data) notFound();
  const plan = data as PlanDetail;
  const pp = plan.plan_prices[0];
  const pricePerNight = pp?.price_per_night ?? 0;
  const roomType = pp?.room_types ?? null;
  const amenities = (roomType?.amenities ?? []) as string[];

  // 日程が指定されていれば空室・料金を算出
  let available: boolean | null = null;
  let price = null as ReturnType<typeof calcPrice> | null;
  const validDates = from && to && eachNight(from, to).length >= 1;
  if (validDates && roomType) {
    const avail = await getTypeAvailability(roomType.id, from!, to!);
    available = eachNight(from!, to!).every((n) => (avail[n] ?? 0) > 0);
    price = calcPrice(from!, to!, pricePerNight, plan.discounts);
  }

  const formQuery = new URLSearchParams();
  formQuery.set("plan", plan.id);
  if (from) formQuery.set("from", from);
  if (to) formQuery.set("to", to);
  if (guests) formQuery.set("guests", guests);

  return (
    <div className="space-y-6">
      <Link href="/reserve" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        ← ホーム
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
        <p className="mt-1 text-sm text-gray-600">日靜（1日1組限定）</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.tags.map((t) => (
            <span key={t} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500">{t}</span>
          ))}
        </div>
      </div>

      {/* 予約バー */}
      <form method="get" className="rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">チェックイン</span>
            <input type="date" name="from" defaultValue={from} className="block rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">チェックアウト</span>
            <input type="date" name="to" defaultValue={to} className="block rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">人数（最大{roomType?.capacity ?? 6}）</span>
            <input type="number" name="guests" min={1} max={roomType?.capacity ?? 6} defaultValue={guests ?? "1"} className="block w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            空室・料金を確認
          </button>

          <div className="ml-auto flex items-center gap-4">
            {price && (
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">¥{price.total.toLocaleString()}</p>
                <p className="text-xs text-gray-500">
                  {price.nights}泊・税サービス料込
                  {price.discountRate > 0 && `（長期割${Math.round(price.discountRate * 100)}%適用）`}
                </p>
              </div>
            )}
            {available === false ? (
              <span className="rounded-full bg-red-50 px-6 py-2.5 text-sm font-medium text-red-600">満室</span>
            ) : validDates && available ? (
              <Link href={`/reserve/form?${formQuery.toString()}`} className="rounded-full bg-teal-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500">
                予約する
              </Link>
            ) : (
              <span className="rounded-full bg-gray-200 px-8 py-2.5 text-sm font-medium text-gray-500">日程を選択</span>
            )}
          </div>
        </div>
        {available && (
          <p className="mt-2 text-sm text-teal-700">✓ 空室があります</p>
        )}
      </form>

      {/* プラン紹介 */}
      <section className="rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">プラン紹介</h2>
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {plan.long_description ?? plan.description}
        </p>

        <hr className="my-6 border-gray-100" />

        <h2 className="mb-3 text-lg font-semibold text-gray-900">客室紹介</h2>
        <p className="text-sm text-gray-700">{roomType?.name ?? "日靜（1日1組限定）"}</p>

        <p className="mt-4 text-sm font-semibold text-gray-900">部屋特徴</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {ROOM_FEATURES.map((f) => (
            <span key={f}>✓ {f}</span>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-900">設備・アメニティ</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {amenities.map((a) => (
            <span key={a}>✓ {a}</span>
          ))}
        </div>

        {plan.discounts.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold text-gray-900">長期割引</p>
            <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
              {plan.discounts.map((d, i) => (
                <li key={i}>
                  📅 {d.min}〜{d.max ?? ""}{d.max ? "泊" : "泊以上"}　{Math.round(d.rate * 100)}％割引
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
