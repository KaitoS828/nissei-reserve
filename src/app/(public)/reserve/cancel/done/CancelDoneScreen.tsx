import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { dict, localePath, type Locale } from "@/lib/i18n";

// 日英で同じ中身を出すための画面本体。
export async function CancelDoneScreen({ code, locale }: { code?: string; locale: Locale }) {
  const t = dict(locale).cancel;
  const c = dict(locale).common;

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
        <h1 className="text-2xl font-bold text-gray-900">{t.doneTitle}</h1>
        <p className="text-sm text-gray-600">{t.doneLead}</p>
      </div>

      {info && (
        <div className="rounded-2xl border border-gray-200 p-6 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{c.reservationCode}</span>
            <span className="font-mono font-semibold text-gray-900">{info.code}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-gray-500">{t.refunded}</span>
            <span className="font-semibold text-brand-700">¥{info.refunded.toLocaleString()}</span>
          </div>
        </div>
      )}

      <Link
        href={localePath(locale, "/reserve")}
        className="inline-block rounded-full bg-brand-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
      >
        {t.home}
      </Link>
    </div>
  );
}
