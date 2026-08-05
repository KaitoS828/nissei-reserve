import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FacilityMetric = {
  facility_id: string;
  facility_name: string;
  facility_slug: string | null;
  facility_status: string;
  public_site_enabled: boolean;
  reservations_total: number;
  reservations_active: number;
  reservations_cancelled: number;
  paid_revenue: number;
  occupied_nights: number;
  last_reservation_at: string | null;
};

const cardClass = "rounded-lg border border-gray-200 bg-white p-5";

function rate(cancelled: number, total: number) {
  return total ? Math.round((cancelled / total) * 100) : 0;
}

export default async function HqPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hq_facility_metrics")
    .select("*")
    .order("paid_revenue", { ascending: false });

  const rows = (data ?? []) as FacilityMetric[];
  const totals = rows.reduce(
    (acc, row) => ({
      facilities: acc.facilities + 1,
      reservations: acc.reservations + Number(row.reservations_total ?? 0),
      revenue: acc.revenue + Number(row.paid_revenue ?? 0),
      active: acc.active + Number(row.reservations_active ?? 0),
    }),
    { facilities: 0, reservations: 0, revenue: 0, active: 0 },
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">本部管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          個人名・メール・電話を含めず、施設ごとの稼働状況だけを確認します。
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          本部集計ビューがまだ作成されていません。Supabaseで最新マイグレーションを適用してください。
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={cardClass}>
          <p className="text-sm text-gray-600">施設数</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-700">{totals.facilities}件</p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-gray-600">総予約数</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-700">{totals.reservations}件</p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-gray-600">進行中予約</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-700">{totals.active}件</p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-gray-600">確定売上</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-700">¥{totals.revenue.toLocaleString()}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] gap-3 border-b border-gray-200 px-4 py-3 text-xs font-medium text-gray-500">
          <span>施設</span>
          <span>状態</span>
          <span className="text-right">予約</span>
          <span className="text-right">売上</span>
          <span className="text-right">取消率</span>
          <span>最終予約</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">施設データがありません。</p>
        ) : rows.map((row) => (
          <div
            key={row.facility_id}
            className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] gap-3 border-b border-gray-200 px-4 py-3 text-sm last:border-b-0"
          >
            <div>
              <p className="font-medium text-gray-900">{row.facility_name}</p>
              {row.facility_slug && (
                <Link href={`/stay/${row.facility_slug}`} className="text-xs text-cyan-700 hover:underline">
                  /stay/{row.facility_slug}
                </Link>
              )}
            </div>
            <span className="text-gray-700">
              {row.facility_status}
              {!row.public_site_enabled && <span className="ml-1 text-amber-700">非公開</span>}
            </span>
            <span className="text-right text-gray-700">{row.reservations_total}件</span>
            <span className="text-right text-gray-700">¥{Number(row.paid_revenue).toLocaleString()}</span>
            <span className="text-right text-gray-700">{rate(row.reservations_cancelled, row.reservations_total)}%</span>
            <span className="text-gray-600">
              {row.last_reservation_at ? new Date(row.last_reservation_at).toLocaleDateString("ja-JP") : "—"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
