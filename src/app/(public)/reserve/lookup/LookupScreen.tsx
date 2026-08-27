import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { dict, localePath, type Locale } from "@/lib/i18n";
import { jstStamp } from "@/lib/datetime";
import type { ReservationStatus } from "@/types/db";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

type ResvDetail = {
  code: string; check_in: string; check_out: string; nights: number;
  num_guests: number; amount: number; status: ReservationStatus; payment_status: string;
  plans: { name: string } | null;
  access_keys: { door_pin: string; status: string; valid_from: string | null; valid_until: string | null } | null;
};

// 日英で同じ中身を出すための画面本体。
export async function LookupScreen({
  code,
  email,
  cancelled,
  locale,
}: {
  code?: string;
  email?: string;
  cancelled?: string;
  locale: Locale;
}) {
  const t = dict(locale).lookup;
  const c = dict(locale).common;
  const f = dict(locale).form;
  const statusLabel = dict(locale).status;

  let resv: ResvDetail | null = null;
  let notFound = false;

  if (code && email) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("reservations")
      .select("code, check_in, check_out, nights, num_guests, amount, status, payment_status, plans(name), customers(email), access_keys(door_pin, status, valid_from, valid_until)")
      .eq("code", code)
      .maybeSingle();
    const custEmail = (data?.customers as unknown as { email: string } | null)?.email;
    if (data && custEmail === email) {
      resv = data as unknown as ResvDetail;
    } else {
      notFound = true;
    }
  }

  // DBは UTC。素の文字列を切り出すと9時間ずれた時刻をお客様に見せてしまう。
  const stamp = (v: string) => jstStamp(v) ?? "—";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>

      {cancelled && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{t.cancelled}</p>
      )}

      <form method="get" className="space-y-3 rounded-2xl border border-gray-200 p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">{c.reservationCode}</span>
          <input name="code" defaultValue={code} placeholder={t.codePlaceholder} required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">{t.emailLabel}</span>
          <input type="email" name="email" defaultValue={email} placeholder="abcde@example.com" required className={field} />
        </label>
        <button className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
          {t.search}
        </button>
      </form>

      {notFound && <p className="text-sm text-gray-500">{t.notFound}</p>}

      {resv && (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-6 text-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="font-mono font-semibold text-gray-900">{resv.code}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{statusLabel[resv.status]}</span>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between"><dt className="text-gray-500">{c.plan}</dt><dd className="text-gray-900">{resv.plans?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">{c.dates}</dt><dd className="text-gray-900">{f.summary(resv.check_in, resv.check_out, resv.nights, resv.num_guests)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">{dict(locale).cancel.paidAmount}</dt><dd className="font-semibold text-gray-900">¥{resv.amount.toLocaleString()}</dd></div>
          </dl>

          {/* 鍵情報 */}
          {resv.status !== "cancelled" && resv.status !== "no_show" && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-2 font-semibold text-gray-800">{t.doorCode}</p>
              {resv.access_keys?.status === "issued" ? (
                <div className="space-y-1">
                  <p className="text-2xl font-mono font-bold tracking-widest text-brand-700">
                    {resv.access_keys.door_pin}
                  </p>
                  {resv.access_keys.valid_from && resv.access_keys.valid_until && (
                    <p className="text-xs text-gray-500">
                      {t.validBetween(stamp(resv.access_keys.valid_from), stamp(resv.access_keys.valid_until))}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">{t.doNotShare}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t.notIssuedYet}</p>
              )}
            </div>
          )}

          {resv.status !== "cancelled" && resv.status !== "checked_out" && (
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs text-gray-500">{t.policy}</p>
              <Link
                href={`${localePath(locale, "/reserve/cancel")}?code=${resv.code}&email=${encodeURIComponent(email ?? "")}`}
                className="block w-full rounded-full border border-red-300 py-2.5 text-center text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t.requestCancel}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
