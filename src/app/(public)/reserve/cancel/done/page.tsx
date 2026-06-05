import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CancelDonePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  let info: { code: string; amount: number; refunded: number } | null = null;
  if (code) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("reservations")
      .select("code, amount, payments(refunded_amount)")
      .eq("code", code)
      .maybeSingle();
    if (data) {
      const refunded = ((data as { payments?: { refunded_amount: number }[] }).payments ?? [])
        .reduce((s, p) => s + (p.refunded_amount ?? 0), 0);
      info = { code: data.code as string, amount: data.amount as number, refunded };
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 pt-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl text-gray-500">✓</div>
        <h1 className="text-2xl font-bold text-gray-900">キャンセルを承りました</h1>
        <p className="text-sm text-gray-600">
          ご予約のキャンセルを受け付けました。確認メールをお送りします。
        </p>
      </div>

      {info && (
        <div className="rounded-2xl border border-gray-200 p-6 text-left text-sm">
          <div className="flex justify-between"><span className="text-gray-500">予約番号</span><span className="font-mono font-semibold text-gray-900">{info.code}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-gray-500">返金額</span><span className="font-semibold text-teal-700">¥{info.refunded.toLocaleString()}</span></div>
        </div>
      )}

      <Link href="/reserve" className="inline-block rounded-full bg-teal-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-teal-500">
        ホームへ
      </Link>
    </div>
  );
}
