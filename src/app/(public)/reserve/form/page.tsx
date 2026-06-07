import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcPrice, type Discount } from "@/lib/pricing";
import { eachNight } from "@/lib/availability";
import { startCheckout } from "./actions";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";
const label = "text-sm font-medium text-gray-900";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINS = ["00", "15", "30", "45"];

export default async function ReserveFormPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string; to?: string; guests?: string; error?: string }>;
}) {
  const { plan: planId, from, to, guests, error } = await searchParams;
  if (!planId) notFound();

  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("*, plan_prices(price_per_night)")
    .eq("id", planId)
    .single();
  if (!plan) notFound();

  const pricePerNight = (plan.plan_prices ?? [])[0]?.price_per_night ?? 0;
  const hasDates = from && to && eachNight(from, to).length >= 1;
  const price = hasDates ? calcPrice(from!, to!, pricePerNight, (plan.discounts ?? []) as Discount[]) : null;

  return (
    <div className="space-y-6">
      <Link href={`/reserve/${planId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        ← 戻る
      </Link>

      {/* 予約サマリ */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <h1 className="text-lg font-semibold text-gray-900">{plan.name}</h1>
        <p className="mt-1 text-sm text-gray-600">日靜（1日1組限定）</p>
        {price && (
          <div className="mt-3 flex items-end justify-between border-t border-gray-200 pt-3">
            <p className="text-sm text-gray-600">{from} 〜 {to}（{price.nights}泊）/ {guests ?? 1}名</p>
            <div className="text-right">
              {price.discountRate > 0 && (
                <p className="text-xs text-gray-500 line-through">¥{price.subtotal.toLocaleString()}</p>
              )}
              <p className="text-xl font-bold text-gray-900">¥{price.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">税・サービス料込</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <form action={startCheckout} className="space-y-6">
        <input type="hidden" name="plan" value={planId} />
        <input type="hidden" name="from" value={from ?? ""} />
        <input type="hidden" name="to" value={to ?? ""} />
        <input type="hidden" name="guests" value={guests ?? "1"} />

        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>氏名 <span className="text-red-500">*</span></span>
            <div className="flex gap-2">
              <input name="last_name" placeholder="姓" required className={field} />
              <input name="first_name" placeholder="名" required className={field} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>氏名（カナ） <span className="text-red-500">*</span></span>
            <div className="flex gap-2">
              <input name="last_name_kana" placeholder="セイ" required className={field} />
              <input name="first_name_kana" placeholder="メイ" required className={field} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>メールアドレス <span className="text-red-500">*</span></span>
            <input type="email" name="email" placeholder="abcde@example.com" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>メールアドレス（確認） <span className="text-red-500">*</span></span>
            <input type="email" name="email2" placeholder="abcde@example.com" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>電話番号 <span className="text-red-500">*</span></span>
            <input name="phone" placeholder="0312345678" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>都道府県（自宅） <span className="text-red-500">*</span></span>
            <input name="prefecture" placeholder="北海道" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>市区町村（自宅） <span className="text-red-500">*</span></span>
            <input name="city" placeholder="広尾郡広尾町" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>番地（自宅） <span className="text-red-500">*</span></span>
            <input name="address" placeholder="山海谷町1-3-11" required className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>建物名（自宅）</span>
            <input name="building" placeholder="谷海山ビル3階" className={field} />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-center">
            <span className={label}>チェックイン予定時刻 <span className="text-red-500">*</span></span>
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
            <span className={label}>ご要望・アンケート</span>
            <textarea name="survey" rows={3} placeholder="・宿泊の目的&#10;・ご要望など" className={field} />
          </div>
          <div className="grid gap-2 md:grid-cols-[160px_1fr]">
            <span className={label}>連絡事項</span>
            <textarea name="contact" rows={3} placeholder="連絡事項がございましたらご入力ください" className={field} />
          </div>
        </div>

        <div className="flex justify-center">
          <button className="rounded-full bg-teal-600 px-12 py-3 font-medium text-white transition hover:bg-teal-500">
            お支払いへ進む
          </button>
        </div>
      </form>
    </div>
  );
}
