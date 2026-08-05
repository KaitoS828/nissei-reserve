import { createAdminClient } from "@/lib/supabase/admin";
import { RefundForm } from "./RefundForm";
import { DeleteForm } from "../_components/DeleteForm";
import { deletePayment } from "./actions";

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
  paid: "bg-cyan-50 text-cyan-700",
  refunded: "bg-gray-100 text-gray-600",
  partially_refunded: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-600",
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
          <h1 className="text-2xl font-semibold text-gray-900">決済</h1>
          <p className="mt-1 text-sm text-gray-600">カード決済履歴・返金</p>
        </div>
        <a
          href="https://dashboard.stripe.com/acct_1TeG8bB3ojaPmd5j/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
        >
          Stripeダッシュボード ↗
        </a>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-700">返金を処理しました。</p>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">決済総額</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-700">¥{totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">返金総額</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">¥{totalRefunded.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">純売上</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">¥{(totalPaid - totalRefunded).toLocaleString()}</p>
        </div>
      </section>

      <div className="space-y-3">
        {payments.length === 0 && <p className="text-sm text-gray-500">決済がありません。</p>}
        {payments.map((p) => {
          const remaining = p.amount - (p.refunded_amount ?? 0);
          return (
            <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <span className="font-mono text-xs text-gray-500">{p.reservations?.code ?? "—"}</span>
                  <span className="text-sm text-gray-900">{custName(p.reservations)}</span>
                </div>
                <div className="text-right text-sm">
                  <span className="font-semibold text-gray-900">¥{p.amount.toLocaleString()}</span>
                  {p.refunded_amount > 0 && (
                    <span className="ml-2 text-amber-700">（返金 ¥{p.refunded_amount.toLocaleString()}）</span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3">
                <span className="font-mono text-xs text-gray-600">{p.stripe_payment_intent_id ?? "—"}</span>
                <div className="flex flex-wrap items-end gap-2">
                  {remaining > 0 && p.status !== "failed" && (
                    <RefundForm
                      paymentId={p.id}
                      remaining={remaining}
                      code={p.reservations?.code ?? "—"}
                    />
                  )}
                  <DeleteForm
                    action={deletePayment}
                    id={p.id}
                    confirmMessage={`予約 ${p.reservations?.code ?? "—"} の決済記録 ¥${p.amount.toLocaleString()} を削除します。\n管理画面の履歴から消えるだけで、Stripe 上の決済・返金は取り消されません。よろしいですか？`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
