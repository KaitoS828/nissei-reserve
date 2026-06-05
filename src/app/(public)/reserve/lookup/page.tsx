import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationStatus } from "@/types/db";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "決済確認中",
  confirmed: "予約確定",
  checked_in: "チェックイン済",
  checked_out: "チェックアウト済",
  cancelled: "キャンセル済",
  no_show: "ノーショー",
};

type ResvDetail = {
  code: string; check_in: string; check_out: string; nights: number;
  num_guests: number; amount: number; status: ReservationStatus; payment_status: string;
  plans: { name: string } | null;
};

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; msg?: string; cancelled?: string }>;
}) {
  const { code, email, msg, cancelled } = await searchParams;

  let resv: ResvDetail | null = null;
  let notFound = false;

  if (code && email) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("reservations")
      .select("code, check_in, check_out, nights, num_guests, amount, status, payment_status, plans(name), customers(email)")
      .eq("code", code)
      .maybeSingle();
    const custEmail = (data?.customers as unknown as { email: string } | null)?.email;
    if (data && custEmail === email) {
      resv = data as unknown as ResvDetail;
    } else {
      notFound = true;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">予約照会・キャンセル</h1>

      {cancelled && (
        <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
          キャンセルを受け付けました。返金がある場合は数日内に処理されます。
        </p>
      )}
      {msg && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{msg}</p>
      )}

      <form method="get" className="space-y-3 rounded-2xl border border-gray-200 p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">予約番号</span>
          <input name="code" defaultValue={code} placeholder="R-20260601-XXXX" required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">ご予約時のメールアドレス</span>
          <input type="email" name="email" defaultValue={email} placeholder="abcde@example.com" required className={field} />
        </label>
        <button className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
          照会する
        </button>
      </form>

      {notFound && (
        <p className="text-sm text-gray-500">該当する予約が見つかりませんでした。予約番号とメールをご確認ください。</p>
      )}

      {resv && (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-6 text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="font-mono font-semibold text-gray-900">{resv.code}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{STATUS_LABEL[resv.status]}</span>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between"><dt className="text-gray-500">プラン</dt><dd className="text-gray-900">{resv.plans?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">日程</dt><dd className="text-gray-900">{resv.check_in} 〜 {resv.check_out}（{resv.nights}泊）</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">人数</dt><dd className="text-gray-900">{resv.num_guests}名</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">金額</dt><dd className="font-semibold text-gray-900">¥{resv.amount.toLocaleString()}</dd></div>
          </dl>

          {resv.status !== "cancelled" && resv.status !== "checked_out" && (
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs text-gray-500">
                キャンセルポリシー: 7日前まで無料 / 3日前まで50% / 当日100%
              </p>
              <Link
                href={`/reserve/cancel?code=${resv.code}&email=${encodeURIComponent(email ?? "")}`}
                className="block w-full rounded-full border border-red-300 py-2.5 text-center text-sm font-medium text-red-600 hover:bg-red-50"
              >
                キャンセルを申請する
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
