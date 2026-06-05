import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ResvSummary = {
  code: string; check_in: string; check_out: string; nights: number;
  num_guests: number; amount: number; payment_status: string;
  plans: { name: string } | null;
};

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  const supabase = createAdminClient();

  let resv: ResvSummary | null = null;

  if (code && token) {
    const { data } = await supabase
      .from("reservations")
      .select("code, check_in, check_out, nights, num_guests, amount, payment_status, plans(name)")
      .eq("code", code)
      .eq("lookup_token", token)
      .maybeSingle();
    resv = data ? (data as unknown as ResvSummary) : null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 pt-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl text-teal-600">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900">ご予約ありがとうございます</h1>
        <p className="text-sm text-gray-600">
          確認メールをお送りしました。当日のご来館をお待ちしております。
        </p>
      </div>

      {resv ? (
        <div className="rounded-2xl border border-gray-200 p-6 text-left text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">予約番号</span>
            <span className="font-mono font-semibold text-gray-900">{resv.code}</span>
          </div>
          <dl className="space-y-2 pt-3">
            <div className="flex justify-between"><dt className="text-gray-500">プラン</dt><dd className="text-gray-900">{resv.plans?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">日程</dt><dd className="text-gray-900">{resv.check_in} 〜 {resv.check_out}（{resv.nights}泊）</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">人数</dt><dd className="text-gray-900">{resv.num_guests}名</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">お支払い金額</dt><dd className="font-semibold text-gray-900">¥{resv.amount.toLocaleString()}</dd></div>
            <div className="flex justify-between">
              <dt className="text-gray-500">状況</dt>
              <dd>
                {resv.payment_status === "paid" ? (
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">決済完了・予約確定</span>
                ) : (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">決済確認中…</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-gray-500">予約情報を確認できませんでした。</p>
      )}

      {/* ご案内 */}
      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-sm text-gray-700">
        <p className="font-semibold text-gray-900">ご予約後のご案内</p>
        <p>📌 <span className="font-semibold">予約番号は必ず保存してください。</span>予約の確認・変更・キャンセルに必要です。</p>
        <p>🔑 会員登録（マイページ）をされている方は、<Link href="/account" className="text-teal-700 underline">マイページ</Link>からいつでもご予約の確認・<span className="font-semibold">キャンセル</span>が可能です。</p>
        <p>📞 ご不明な点は <a href="tel:07012516275" className="font-semibold text-teal-700">070-1251-6275</a> までお問い合わせください。</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/reserve" className="rounded-full border border-gray-300 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
          ホームへ
        </Link>
        {resv && (
          <Link href={`/reserve/lookup?code=${resv.code}`} className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500">
            予約を確認
          </Link>
        )}
        {resv && resv.payment_status === "paid" && token && (
          <Link href={`/reserve/receipt?code=${resv.code}&token=${token}`} className="rounded-full border border-gray-300 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            領収書
          </Link>
        )}
      </div>
    </div>
  );
}
