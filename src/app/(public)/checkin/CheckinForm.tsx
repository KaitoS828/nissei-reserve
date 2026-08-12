"use client";

import { useActionState } from "react";
import { checkinAction, type CheckinState } from "./actions";
import { dict, type Locale } from "@/lib/i18n";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

export function CheckinForm({ locale = "ja" }: { locale?: Locale }) {
  const t = dict(locale).checkin;
  const [state, formAction, pending] = useActionState<CheckinState, FormData>(
    checkinAction,
    { status: "idle" },
  );
  const localeField = <input type="hidden" name="locale" value={locale} />;

  if (state.status !== "ok") {
    const { code, email } = state.status === "error" ? state : { code: "", email: "" };
    return (
      <>
        <p className="text-sm text-gray-600">{t.lead}</p>

        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.message}</p>
        )}

        <form action={formAction} className="space-y-3 rounded-2xl border border-gray-200 p-6">
          <input type="hidden" name="intent" value="verify" />
          {localeField}
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-900">{dict(locale).common.reservationCode}</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="R-20260601-XXXX"
              required
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-900">{dict(locale).common.email}</span>
            <input
              type="email"
              name="email"
              defaultValue={email}
              placeholder="abcde@example.com"
              required
              className={field}
            />
          </label>
          <button
            disabled={pending}
            className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {pending ? t.verifying : t.showCode}
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 p-6 text-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="font-mono font-semibold text-gray-900">{state.code}</span>
          <span className="text-gray-700">{locale === "en" ? state.guestName : `${state.guestName} 様`}</span>
        </div>
        <dl className="space-y-2 pt-3">
          <div className="flex justify-between">
            <dt className="text-gray-500">{dict(locale).common.plan}</dt>
            <dd className="text-gray-900">{state.planName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{dict(locale).common.dates}</dt>
            <dd className="text-gray-900">
              {state.checkIn} 〜 {state.checkOut}（{state.nights} {dict(locale).common.nights}）
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{dict(locale).common.guests}</dt>
            <dd className="text-gray-900">{state.numGuests}{locale === "en" ? "" : "名"}</dd>
          </div>
        </dl>
      </div>

      {state.doorPin ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
          <p className="text-sm font-medium text-teal-800">{t.doorCode}</p>
          <p className="my-3 font-mono text-4xl font-bold tracking-[0.2em] text-gray-900">
            {state.doorPin}
          </p>
          {state.validFrom && state.validUntil && (
            <p className="text-xs text-teal-800">
              {state.validFrom} 〜 {state.validUntil} {t.validBetween}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-600">{t.howToOpen} {t.doNotShare}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">{t.notIssued}</p>
          <p className="mt-2 text-xs">
            {t.contactUs}
            {state.phone && <span className="font-semibold">（{state.phone}）</span>}
          </p>
        </div>
      )}

      {state.checkedIn ? (
        <p className="rounded-lg bg-gray-100 px-4 py-3 text-center text-sm text-gray-700">
          {t.checkedIn}
        </p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="intent" value="checkin" />
          {localeField}
          <input type="hidden" name="code" value={state.code} />
          <input type="hidden" name="email" value={state.email} />
          <button
            disabled={pending}
            className="w-full rounded-full bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? dict(locale).common.loading : t.doCheckin}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            {t.arrivalNote}
          </p>
        </form>
      )}
    </div>
  );
}
