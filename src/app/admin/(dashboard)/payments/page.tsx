import { createAdminClient } from "@/lib/supabase/admin";
import { RefundForm } from "./RefundForm";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string; amount: number; refunded_amount: number; status: string;
  stripe_payment_intent_id: string | null; created_at: string;
  reservations: {
    code: string;
    customers: { last_name: string | null; first_name: string | null } | null;
  } | null;
};

const STATUS_CLS: Record<string, string> = {
  paid: "bg-cyan-950 text-cyan-400",
  refunded: "bg-gray-800 text-gray-400",
  partially_refunded: "bg-amber-950 text-amber-400",
  failed: "bg-red-950 text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "支払済", refunded: "返金済", partially_refunded: "一部返金", failed: "失敗",
  unpaid: "未払い", authorized: "オーソリ",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, refunded_amount, status, stripe_payment_intent_id, created_at, reservations(code, customers(last_name, first_name))")
    .order("created_at", { ascending: false });
  const payments = (data ?? []) as unknown as PaymentRow[];

  const custName = (r: PaymentRow["reservations"]) =>
    r?.customers ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ") || "—" : "—";

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.reduce((s, p) => s + (p.refunded_amount ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">決済</h1>
          <p className="mt-1 text-sm text-gray-400">カード決済履歴・返金</p>
        </div>
        <a
          href="https://dashboard.stripe.com/acct_1TeG8bB3ojaPmd5j/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
        >
          Stripeダッシュボード ↗
        </a>
      </header>

      {error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}
      {ok && <p className="rounded-lg bg-cyan-950/60 px-3 py-2 text-sm text-cyan-300">返金を処理しました。</p>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <p className="text-sm text-gray-400">決済総額</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-400">¥{totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <p className="text-sm text-gray-400">返金総額</p>
          <p className="mt-2 text-2xl font-semibold text-amber-400">¥{totalRefunded.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
          <p className="text-sm text-gray-400">純売上</p>
          <p className="mt-2 text-2xl font-semibold text-white">¥{(totalPaid - totalRefunded).toLocaleString()}</p>
        </div>
      </section>

      <div className="space-y-3">
        {payments.length === 0 && <p className="text-sm text-gray-500">決済がありません。</p>}
        {payments.map((p) => {
          const remaining = p.amount - (p.refunded_amount ?? 0);
          return (
            <div key={p.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[p.status] ?? "bg-gray-800 text-gray-400"}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <span className="font-mono text-xs text-gray-500">{p.reservations?.code ?? "—"}</span>
                  <span className="text-sm text-white">{custName(p.reservations)}</span>
                </div>
                <div className="text-right text-sm">
                  <span className="font-semibold text-white">¥{p.amount.toLocaleString()}</span>
                  {p.refunded_amount > 0 && (
                    <span className="ml-2 text-amber-400">（返金 ¥{p.refunded_amount.toLocaleString()}）</span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
                <span className="font-mono text-xs text-gray-600">{p.stripe_payment_intent_id ?? "—"}</span>
                {remaining > 0 && p.status !== "failed" && (
                  <RefundForm
                    paymentId={p.id}
                    remaining={remaining}
                    code={p.reservations?.code ?? "—"}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
