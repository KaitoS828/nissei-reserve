import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type ReceiptResv = {
  code: string; check_in: string; check_out: string; nights: number;
  amount: number; payment_status: string; created_at: string;
  customers: { last_name: string | null; first_name: string | null } | null;
  plans: { name: string } | null;
};

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  const supabase = createAdminClient();

  let resv: ReceiptResv | null = null;
  if (code && token) {
    const { data } = await supabase
      .from("reservations")
      .select("code, check_in, check_out, nights, amount, payment_status, created_at, customers(last_name, first_name), plans(name)")
      .eq("code", code)
      .eq("lookup_token", token)
      .maybeSingle();
    resv = (data as unknown as ReceiptResv) ?? null;
  }
  const { data: facility } = await supabase.from("facility").select("name, address, phone").limit(1).single();

  if (!resv) {
    return <p className="text-sm text-gray-500">領収書を表示できませんでした。</p>;
  }
  if (resv.payment_status !== "paid") {
    return <p className="text-sm text-gray-500">お支払い完了後に領収書を発行できます。</p>;
  }

  const name = [resv.customers?.last_name, resv.customers?.first_name].filter(Boolean).join(" ") || "ご宿泊者";
  const issued = new Date(resv.created_at).toLocaleDateString("ja-JP");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-end">
        <PrintButton />
      </div>

      <div className="printable rounded-2xl border border-gray-300 bg-white p-10">
        <h1 className="text-center text-2xl font-bold tracking-widest text-gray-900">領　収　書</h1>
        <p className="mt-2 text-right text-sm text-gray-500">発行日: {issued}</p>

        <div className="mt-8 space-y-1">
          <p className="border-b border-gray-400 pb-1 text-lg text-gray-900">{name} 様</p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">金額</p>
          <p className="text-3xl font-bold text-gray-900">¥{resv.amount.toLocaleString()}-</p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-700">
          但し　ご宿泊代として（{resv.plans?.name}）
        </p>

        <table className="mx-auto mt-8 text-sm text-gray-700">
          <tbody>
            <tr><td className="py-1 pr-6 text-gray-500">予約番号</td><td className="font-mono">{resv.code}</td></tr>
            <tr><td className="py-1 pr-6 text-gray-500">宿泊日</td><td>{resv.check_in} 〜 {resv.check_out}（{resv.nights}泊）</td></tr>
          </tbody>
        </table>

        <p className="mt-2 text-center text-xs text-gray-500">上記正に領収いたしました。</p>

        <div className="mt-10 text-right text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{facility?.name}</p>
          <p>{facility?.address}</p>
          <p>{facility?.phone}</p>
        </div>
      </div>
    </div>
  );
}
