import { SubmitButton } from "@/components/SubmitButton";
import { PlanGalleryEditor } from "@/components/PlanGalleryEditor";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/types/db";
import { createPlan, updatePlan, togglePlanActive, deletePlan, setPlanPrice } from "./actions";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const btnPrimary =
  "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700";

const MEAL = [
  { value: "none", label: "食事なし" },
  { value: "breakfast", label: "朝食付き" },
  { value: "dinner", label: "夕食付き" },
  { value: "both", label: "朝夕食付き" },
];
const mealLabel = (v: string | null) =>
  MEAL.find((m) => m.value === v)?.label ?? "—";

type RoomType = { id: string; name: string; capacity: number | null };
type PlanPrice = {
  plan_id: string;
  room_type_id: string;
  price_per_night: number;
  guest_prices: Record<string, number> | null;
};

export default async function PlansPage() {
  const supabase = createAdminClient();
  const [{ data: planData }, { data: rtData }, { data: priceData }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order", { ascending: true }),
    supabase.from("room_types").select("id, name, capacity").eq("is_active", true).order("sort_order"),
    supabase.from("plan_prices").select("plan_id, room_type_id, price_per_night, guest_prices"),
  ]);
  const plans = (planData ?? []) as Plan[];
  const roomTypes = (rtData ?? []) as RoomType[];
  const prices = (priceData ?? []) as PlanPrice[];
  const rowOf = (planId: string, rtId: string) =>
    prices.find((p) => p.plan_id === planId && p.room_type_id === rtId);
  const priceOf = (planId: string, rtId: string) => rowOf(planId, rtId)?.price_per_night ?? "";
  const guestPriceOf = (planId: string, rtId: string, n: number) =>
    rowOf(planId, rtId)?.guest_prices?.[String(n)] ?? "";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">宿泊プラン</h1>
        <p className="mt-1 text-sm text-gray-600">
          素泊まり・朝食付きなどの宿泊プラン
        </p>
      </header>

      <form
        action={createPlan}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-5"
      >
        <input name="name" placeholder="プラン名" required className={`${field} md:col-span-2`} />
        <select name="meal_type" className={field} defaultValue="none">
          {MEAL.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input name="sort_order" type="number" defaultValue={0} placeholder="表示順" className={field} />
        <SubmitButton className={btnPrimary}>追加</SubmitButton>
        <input name="description" placeholder="説明（任意）" className={`${field} md:col-span-5`} />
      </form>

      <div className="space-y-3">
        {plans.length === 0 && (
          <p className="text-sm text-gray-500">プランがまだありません。</p>
        )}
        {plans.map((plan) => (
          <details
            key={plan.id}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{plan.name}</span>
                {!plan.is_active && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    無効
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {mealLabel(plan.meal_type)}
              </span>
            </summary>

            <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
              <form action={updatePlan} className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <input type="hidden" name="id" value={plan.id} />
                <input name="name" defaultValue={plan.name} required className={`${field} md:col-span-2`} />
                <select name="meal_type" defaultValue={plan.meal_type ?? "none"} className={field}>
                  {MEAL.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input name="sort_order" type="number" defaultValue={plan.sort_order} className={field} />
                <SubmitButton className={btnPrimary}>保存</SubmitButton>
                <input name="description" defaultValue={plan.description ?? ""} placeholder="説明" className={`${field} md:col-span-5`} />
              </form>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-100 p-4">
                <p className="text-xs font-medium text-gray-600">プラン詳細ページに載せる写真</p>
                <PlanGalleryEditor planId={plan.id} initialImages={plan.gallery_images ?? []} />
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-100 p-4">
                <p className="text-xs font-medium text-gray-600">1泊あたりの料金（客室タイプ別）</p>
                {roomTypes.length === 0 && (
                  <p className="text-sm text-gray-500">客室タイプが未登録です。</p>
                )}
                {roomTypes.map((rt) => (
                  <form
                    key={rt.id}
                    action={setPlanPrice}
                    className="space-y-3 rounded-lg border border-gray-200 p-3"
                  >
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <input type="hidden" name="room_type_id" value={rt.id} />

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-20 text-sm font-medium text-gray-800">{rt.name}</span>
                      <span className="text-xs text-gray-500">設定料金</span>
                      <span className="text-sm text-gray-500">¥</span>
                      <input
                        name="price_per_night"
                        type="number"
                        min={0}
                        step={100}
                        defaultValue={priceOf(plan.id, rt.id)}
                        placeholder="未設定"
                        required
                        className={`${field} w-32`}
                      />
                      <span className="text-xs text-gray-500">/泊（人数別が空の人数のフォールバック）</span>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs text-gray-600">
                        人数別料金（1泊・空欄なら設定料金を使用）
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {Array.from({ length: rt.capacity ?? 6 }, (_, i) => i + 1).map((n) => (
                          <label key={n} className="flex items-center gap-1.5">
                            <span className="w-8 shrink-0 text-xs text-gray-600">{n}名</span>
                            <input
                              name={`guest_${n}`}
                              type="number"
                              min={0}
                              step={100}
                              defaultValue={guestPriceOf(plan.id, rt.id, n)}
                              placeholder="¥"
                              className={`${field} w-full`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <SubmitButton className={btnPrimary}>料金を保存</SubmitButton>
                  </form>
                ))}
              </div>

              <div className="flex gap-2">
                <form action={togglePlanActive}>
                  <input type="hidden" name="id" value={plan.id} />
                  <input type="hidden" name="is_active" value={String(!plan.is_active)} />
                  <SubmitButton className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">
                    {plan.is_active ? "無効化" : "有効化"}
                  </SubmitButton>
                </form>
                <form action={deletePlan}>
                  <input type="hidden" name="id" value={plan.id} />
                  <SubmitButton className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-100">
                    削除
                  </SubmitButton>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
