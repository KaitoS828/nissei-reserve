import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { dict, localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

type ResvSummary = {
  code: string; check_in: string; check_out: string; nights: number;
  num_guests: number; amount: number; payment_status: string;
  plans: { name: string } | null;
};

// 日英で同じ中身を出すための画面本体。
export async function CompleteScreen({
  code,
  token,
  locale,
}: {
  code?: string;
  token?: string;
  locale: Locale;
}) {
  const t = dict(locale).complete;
  const c = dict(locale).common;
  const f = dict(locale).form;
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

  const checkinLink = (
    <Link href={localePath(locale, "/checkin")} className="text-teal-700 underline">
      {dict(locale).checkin.title}
    </Link>
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 pt-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl text-teal-600">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="text-sm text-gray-600">{t.lead}</p>
      </div>

      {resv ? (
        <div className="rounded-2xl border border-gray-200 p-6 text-left text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">{c.reservationCode}</span>
            <span className="font-mono font-semibold text-gray-900">{resv.code}</span>
          </div>
          <dl className="space-y-2 pt-3">
            <div className="flex justify-between"><dt className="text-gray-500">{c.plan}</dt><dd className="text-gray-900">{resv.plans?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">{c.dates}</dt><dd className="text-gray-900">{f.summary(resv.check_in, resv.check_out, resv.nights, resv.num_guests)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">{t.amount}</dt><dd className="font-semibold text-gray-900">¥{resv.amount.toLocaleString()}</dd></div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t.statusLabel}</dt>
              <dd>
                {resv.payment_status === "paid" ? (
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{t.paid}</span>
                ) : (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">{t.pending}</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{t.notFound}</p>
      )}

      {/* ご案内 */}
      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-sm text-gray-700">
        <p className="font-semibold text-gray-900">{t.guideTitle}</p>
        <p>📌 {t.guideCode}</p>
        <p>📧 {t.guideEmail}</p>
        <p>🚪 {t.guideDoor.before}{checkinLink}{t.guideDoor.after}</p>
        <p>
          📞 {t.guidePhone}{" "}
          <a href={`tel:${SITE.phone.replace(/-/g, "")}`} className="font-semibold text-teal-700">{SITE.phone}</a>
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={localePath(locale, "/reserve")} className="rounded-full border border-gray-300 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
          {t.home}
        </Link>
        {resv && (
          <Link href={`${localePath(locale, "/reserve/lookup")}?code=${resv.code}`} className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500">
            {t.viewBooking}
          </Link>
        )}
        {resv && resv.payment_status === "paid" && token && (
          <Link href={`${localePath(locale, "/reserve/receipt")}?code=${resv.code}&token=${token}`} className="rounded-full border border-gray-300 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            {t.receipt}
          </Link>
        )}
      </div>
    </div>
  );
}
