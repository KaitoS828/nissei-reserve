"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";

// 手動予約でもそのまま送れるよう、本文をまるごとコピーできるようにする。
export function BookingGuide({
  subject,
  body,
  email,
  lastSentAt,
  sendAction,
  reservationId,
  hasDoorPin,
}: {
  subject: string;
  body: string;
  email: string | null;
  lastSentAt: string | null;
  sendAction: (formData: FormData) => void;
  reservationId: string;
  hasDoorPin: boolean;
}) {
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const copy = async (kind: "subject" | "body", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-800">
        予約時メール（コピーして送れます）
      </summary>

      <div className="space-y-3 border-t border-gray-200 p-4">
        {/* PIN 未発行のまま送ると「追ってご連絡します」で届き、送り直しが要る */}
        {!hasDoorPin && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ドアPINがまだ発行されていません。このまま送ると本文には番号が入らず「追ってご連絡いたします」と記載されます。
            <span className="font-medium">先に上の「ドアPINを発行」を押してから送信してください。</span>
          </p>
        )}

        {/* 送信済みかどうかが分からないと二重に送ってしまうので、必ず状態を出す */}
        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2">
          {email ? (
            <>
              <form action={sendAction}>
                <ConfirmButton
                  hidden={{ id: reservationId }}
                  title={lastSentAt ? "このメールを再送します" : "このメールを送信します"}
                  message={
                    <>
                      <p>
                        {email} 宛に「{subject}」を送信します。お客様に直接届きます。
                      </p>
                      {lastSentAt && (
                        <p className="mt-2 text-amber-700">
                          このメールは {lastSentAt} に送信済みです。同じ内容がもう一度届きます。
                        </p>
                      )}
                      {!hasDoorPin && (
                        <p className="mt-2 text-amber-700">
                          ドアPINが未発行のため、本文には番号が入らず「追ってご連絡いたします」と
                          記載されます。あとで番号をお伝えする必要があります。
                        </p>
                      )}
                      <p className="mt-2">送信してよろしいですか？</p>
                    </>
                  }
                  confirmLabel="はい、送信する"
                  className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
                >
                  {lastSentAt ? "このメールを再送する" : "このメールを送信する"}
                </ConfirmButton>
              </form>
              <span className="text-xs text-gray-600">宛先: {email}</span>
              <span className="text-xs text-gray-500">
                {lastSentAt ? `送信済み（${lastSentAt}）` : "未送信"}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-500">
              メールアドレスが未登録のため送信できません。下記をコピーしてお使いください。
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">件名</span>
            <button
              type="button"
              onClick={() => copy("subject", subject)}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              {copied === "subject" ? "コピーしました" : "件名をコピー"}
            </button>
          </div>
          <p className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
            {subject}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">本文</span>
            <button
              type="button"
              onClick={() => copy("body", body)}
              className="rounded bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-700"
            >
              {copied === "body" ? "コピーしました" : "本文をコピー"}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-900">
            {body}
          </pre>
        </div>
      </div>
    </details>
  );
}
