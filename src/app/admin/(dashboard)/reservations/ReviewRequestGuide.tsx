"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";

export function ReviewRequestGuide({
  subject,
  body,
  email,
  lastSentAt,
  sendAction,
  reservationId,
}: {
  subject: string;
  body: string;
  email: string | null;
  lastSentAt: string | null;
  sendAction: (formData: FormData) => void;
  reservationId: string;
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
    <details className="rounded-lg border border-emerald-200 bg-emerald-50/40">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-emerald-900 flex items-center justify-between">
        <span>⭐ Googleレビュー依頼メール（口コミお願い）</span>
        {lastSentAt ? (
          <span className="text-xs font-normal text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            送信済（{lastSentAt}）
          </span>
        ) : (
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            未送信
          </span>
        )}
      </summary>

      <div className="space-y-3 border-t border-emerald-200 p-4 bg-white">
        <p className="text-xs text-gray-600">
          チェックアウトされたお客様へ、ご滞在のお礼とお部屋を綺麗に使っていただいた感謝、Googleクチコミ投稿のお願いメールを送信できます。
        </p>

        {/* 送信ボタン・ステータス */}
        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
          {email ? (
            <>
              <form action={sendAction}>
                <ConfirmButton
                  hidden={{ id: reservationId }}
                  title={lastSentAt ? "レビュー依頼メールを再送します" : "レビュー依頼メールを送信します"}
                  message={
                    <>
                      <p>
                        {email} 宛に「{subject}」を送信します。
                      </p>
                      {lastSentAt && (
                        <p className="mt-2 text-amber-700 font-medium">
                          ※ このメールは {lastSentAt} に送信済みです。再送してもよろしいですか？
                        </p>
                      )}
                      <p className="mt-2">送信してよろしいですか？</p>
                    </>
                  }
                  confirmLabel="はい、送信する"
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  {lastSentAt ? "レビュー依頼メールを再送する" : "レビュー依頼メールを送信する"}
                </ConfirmButton>
              </form>
              <span className="text-xs text-gray-600">宛先: {email}</span>
              <span className="text-xs text-emerald-700 font-medium">
                {lastSentAt ? `送信済み（${lastSentAt}）` : "未送信"}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-500">
              メールアドレスが未登録のため送信できません。下記をコピーしてお使いください。
            </span>
          )}
        </div>

        {/* 件名 */}
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
          <p className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-medium">
            {subject}
          </p>
        </div>

        {/* 本文 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">本文プレビュー</span>
            <button
              type="button"
              onClick={() => copy("body", body)}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {copied === "body" ? "コピーしました" : "本文をコピー"}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-900">
            {body}
          </pre>
        </div>
      </div>
    </details>
  );
}
