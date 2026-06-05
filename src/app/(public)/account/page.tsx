import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import type { ReservationStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type MyResv = {
  code: string; check_in: string; check_out: string; nights: number;
  num_guests: number; amount: number; status: ReservationStatus;
  plans: { name: string } | null;
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "決済確認中", confirmed: "予約確定", checked_in: "滞在中",
  checked_out: "完了", cancelled: "キャンセル済", no_show: "ノーショー",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/account/login");

  // RLS により自分の予約のみ取得
  const { data } = await supabase
    .from("reservations")
    .select("code, check_in, check_out, nights, num_guests, amount, status, plans(name)")
    .order("check_in", { ascending: false });
  const reservations = (data ?? []) as unknown as MyResv[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
        <form action={logout}>
          <button className="text-sm text-gray-500 hover:text-gray-800">ログアウト</button>
        </form>
      </div>
      <p className="text-sm text-gray-500">{user.email}</p>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">予約履歴</h2>
        <Link href="/reserve" className="rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500">新しく予約する</Link>
      </div>

      <div className="space-y-3">
        {reservations.length === 0 && <p className="text-sm text-gray-500">まだ予約がありません。</p>}
        {reservations.map((r) => (
          <div key={r.code} className="rounded-2xl border border-gray-200 p-5 text-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="font-mono font-semibold text-gray-900">{r.code}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="flex items-center justify-between pt-2 text-gray-700">
              <span>{r.plans?.name} / {r.check_in}〜{r.check_out}（{r.nights}泊）/ {r.num_guests}名</span>
              <span className="font-semibold">¥{r.amount.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <Link href={`/reserve/lookup?code=${r.code}&email=${encodeURIComponent(user.email ?? "")}`} className="text-teal-700 hover:underline">詳細・キャンセル</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
