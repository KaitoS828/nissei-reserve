"use client";

import { refundPayment } from "./actions";

export function RefundForm({
  paymentId,
  remaining,
  code,
}: {
  paymentId: string;
  remaining: number;
  code: string;
}) {
  return (
    <form
      action={refundPayment}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("amount") as HTMLInputElement | null;
        const amt = Number(input?.value) > 0 ? Number(input!.value) : remaining;
        const ok = window.confirm(
          `予約 ${code} に ¥${amt.toLocaleString()} を返金します。\n` +
            `Stripe で実際に返金され、取り消せません。よろしいですか？`,
        );
        if (!ok) e.preventDefault();
      }}
      className="flex items-end gap-2"
    >
      <input type="hidden" name="payment_id" value={paymentId} />
      <input
        name="amount"
        type="number"
        min={1}
        max={remaining}
        placeholder={`全額 ¥${remaining.toLocaleString()}`}
        className="w-36 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
      />
      <button className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40">
        返金する
      </button>
    </form>
  );
}
