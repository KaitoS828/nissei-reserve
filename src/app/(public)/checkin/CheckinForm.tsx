"use client";

import { useActionState } from "react";
import { checkinAction, type CheckinState } from "./actions";

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

export function CheckinForm() {
  const [state, formAction, pending] = useActionState<CheckinState, FormData>(
    checkinAction,
    { status: "idle" },
  );

  if (state.status !== "ok") {
    const { code, email } = state.status === "error" ? state : { code: "", email: "" };
    return (
      <>
        <p className="text-sm text-gray-600">
          ご予約時の情報を入力すると、玄関のドアコードをご確認いただけます。
        </p>

        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.message}</p>
        )}

        <form action={formAction} className="space-y-3 rounded-2xl border border-gray-200 p-6">
          <input type="hidden" name="intent" value="verify" />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-900">予約番号</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="R-20260601-XXXX"
              required
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-900">ご予約時のメールアドレス</span>
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
            {pending ? "確認中…" : "ドアコードを表示する"}
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
          <span className="text-gray-700">{state.guestName} 様</span>
        </div>
        <dl className="space-y-2 pt-3">
          <div className="flex justify-between">
            <dt className="text-gray-500">プラン</dt>
            <dd className="text-gray-900">{state.planName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">日程</dt>
            <dd className="text-gray-900">
              {state.checkIn} 〜 {state.checkOut}（{state.nights}泊）
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">人数</dt>
            <dd className="text-gray-900">{state.numGuests}名</dd>
          </div>
        </dl>
      </div>

      {state.doorPin ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
          <p className="text-sm font-medium text-teal-800">玄関のドアコード</p>
          <p className="my-3 font-mono text-4xl font-bold tracking-[0.2em] text-gray-900">
            {state.doorPin}
          </p>
          {state.validFrom && state.validUntil && (
            <p className="text-xs text-teal-800">
              {state.validFrom} 〜 {state.validUntil} の間だけ有効です
            </p>
          )}
          <p className="mt-3 text-xs text-gray-600">
            キーパッドに番号を入力し、最後に丸いボタンを押すと解錠します。
            この番号は他の方に共有しないでください。
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">ドアコードがまだ発行されていません。</p>
          <p className="mt-2 text-xs">
            お手数ですが宿までご連絡ください。
            {state.phone && <span className="font-semibold">（{state.phone}）</span>}
          </p>
        </div>
      )}

      {state.checkedIn ? (
        <p className="rounded-lg bg-gray-100 px-4 py-3 text-center text-sm text-gray-700">
          チェックインを受け付けました。ごゆっくりお過ごしください。
        </p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="intent" value="checkin" />
          <input type="hidden" name="code" value={state.code} />
          <input type="hidden" name="email" value={state.email} />
          <button
            disabled={pending}
            className="w-full rounded-full bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? "送信中…" : "チェックインする"}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            到着されたらお知らせください。宿側に到着が伝わります。
          </p>
        </form>
      )}
    </div>
  );
}
