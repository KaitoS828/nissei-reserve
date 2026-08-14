import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRefund, CANCEL_CATEGORIES } from "@/lib/cancel";
import { dict, localePath, term, type Locale } from "@/lib/i18n";
import { confirmCancel } from "./actions";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

type ResvRow = {
  id: string; code: string; check_in: string; check_out: string; nights: number;
  amount: number; status: string;
  plans: { name: string } | null;
  customers: { email: string } | null;
};

// 日英で同じ中身を出すための画面本体。
// キャンセル理由は DB には日本語のまま入れ、表示だけ訳す（集計を壊さないため）。
export async function CancelScreen({
  code,
  email,
  error,
  locale,
}: {
  code?: string;
  email?: string;
  error?: string;
  locale: Locale;
}) {
  const t = dict(locale).cancel;
  const c = dict(locale).common;
  const l = dict(locale).lookup;

  let resv: ResvRow | null = null;
  if (code && email) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("reservations")
      .select("id, code, check_in, check_out, nights, amount, status, plans(name), customers(email)")
      .eq("code", code)
      .maybeSingle();
    const custEmail = (data as unknown as ResvRow | null)?.customers?.email;
    if (data && custEmail === email) resv = data as unknown as ResvRow;
  }

  if (!resv) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="text-sm text-gray-600">{t.notFound}</p>
        <Link href={localePath(locale, "/reserve/lookup")} className="text-sm text-teal-700 hover:underline">
          {t.backToLookup}
        </Link>
      </div>
    );
  }

  if (resv.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">{t.alreadyCancelled}</p>
        <Link href={localePath(locale, "/reserve")} className="text-sm text-teal-700 hover:underline">{t.home}</Link>
      </div>
    );
  }

  const { data: facility } = await createAdminClient().from("facility").select("cancel_policy").limit(1).single();
  const refund = computeRefund(resv.amount, resv.check_in, (facility?.cancel_policy ?? null) as Record<string, number> | null);

  const errorText = error ? (t.errors[error] ?? t.errors.generic) : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>

      {errorText && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorText}</p>}

      {/* 予約内容 */}
      <div className="rounded-2xl border border-gray-200 p-5 text-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="font-mono font-semibold text-gray-900">{resv.code}</span>
          <span className="text-gray-500">{resv.plans?.name}</span>
        </div>
        <dl className="space-y-2 pt-3">
          <div className="flex justify-between">
            <dt className="text-gray-500">{c.dates}</dt>
            <dd className="text-gray-900">{t.dateRange(resv.check_in, resv.check_out, resv.nights)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t.paidAmount}</dt>
            <dd className="text-gray-900">¥{resv.amount.toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {/* 返金予定額 */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <p className="text-sm font-medium text-gray-900">{t.refundAmount}</p>
        <p className="mt-1 text-3xl font-bold text-teal-700">¥{refund.refundAmount.toLocaleString()}</p>
        <p className="mt-2 text-xs text-gray-600">
          {t.refundNote(refund.daysBefore, Math.round(refund.chargeRate * 100), refund.feeAmount.toLocaleString())}
        </p>
        <p className="mt-1 text-xs text-gray-500">{l.policy}</p>
      </div>

      {/* 理由フォーム */}
      <form action={confirmCancel} className="space-y-4 rounded-2xl border border-gray-200 p-6">
        <input type="hidden" name="code" value={resv.code} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="locale" value={locale} />

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-900">{t.reason} <span className="text-red-500">*</span></span>
          <div className="space-y-1.5">
            {CANCEL_CATEGORIES.map((cat, i) => (
              <label key={cat} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="category" value={cat} required defaultChecked={i === 0} className="accent-teal-600" />
                {term(locale, cat)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium text-gray-900">{t.detail}</span>
          <textarea name="reason" rows={3} placeholder={t.detailPlaceholder} className={field} />
        </div>

        <p className="text-xs text-gray-500">{t.irreversible}</p>

        <div className="flex justify-end gap-3">
          <Link href={localePath(locale, "/reserve/lookup")} className="rounded-full border border-gray-300 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            {t.back}
          </Link>
          <SubmitButton pendingLabel={t.confirming} className="rounded-full bg-red-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-red-500">
            {t.confirm}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
