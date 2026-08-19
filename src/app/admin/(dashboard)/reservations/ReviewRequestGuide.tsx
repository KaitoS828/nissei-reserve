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
  const [currentSubject, setCurrentSubject] = useState(subject);
  const [currentBody, setCurrentBody] = useState(body);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const isEdited = currentSubject !== subject || currentBody !== body;

  const handleReset = () => {
    setCurrentSubject(subject);
    setCurrentBody(body);
  };

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
        <span>⭐ Googleレビュー依頼メール（口コミお願い・編集可）</span>
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

      <div className="space-y-4 border-t border-emerald-200 p-4 bg-white">
        <p className="text-xs text-gray-600">
          チェックアウトされたお客様へ、ご滞在のお礼とお部屋を綺麗に使っていただいた感謝、Googleクチコミ投稿のお願いメールを送信できます。
          <span className="font-medium text-emerald-800">（件名・本文は自由に編集して送信できます）</span>
        </p>

        {/* 送信ボタン・ステータス */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
          {email ? (
            <div className="flex flex-wrap items-center gap-3">
              <form action={sendAction}>
                <input type="hidden" name="custom_subject" value={currentSubject} />
                <input type="hidden" name="custom_body" value={currentBody} />
                <ConfirmButton
                  hidden={{ id: reservationId }}
                  title={lastSentAt ? "レビュー依頼メールを再送します" : "レビュー依頼メールを送信します"}
                  message={
                    <>
                      <p>
                        {email} 宛に「{currentSubject}」を送信します。
                      </p>
                      {isEdited && (
                        <p className="mt-2 text-xs text-emerald-700 font-medium">
                          ※ 編集した本文・件名で送信されます。
                        </p>
                      )}
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
                  {lastSentAt ? "この内容で再送する" : "この内容で送信する"}
                </ConfirmButton>
              </form>
              <span className="text-xs text-gray-600">宛先: {email}</span>
              <span className="text-xs text-emerald-700 font-medium">
                {lastSentAt ? `送信済み（${lastSentAt}）` : "未送信"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-500">
              メールアドレスが未登録のため送信できません。下記をコピーしてお使いください。
            </span>
          )}

          {isEdited && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              初期文面に戻す
            </button>
          )}
        </div>

        {/* 件名編集 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">件名（編集可能）</label>
            <button
              type="button"
              onClick={() => copy("subject", currentSubject)}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              {copied === "subject" ? "コピーしました" : "件名をコピー"}
            </button>
          </div>
          <input
            type="text"
            value={currentSubject}
            onChange={(e) => setCurrentSubject(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* 本文編集 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">本文（編集可能）</label>
            <div className="flex items-center gap-2">
              {isEdited && (
                <span className="text-xs text-amber-600 font-medium">※ 編集されています</span>
              )}
              <button
                type="button"
                onClick={() => copy("body", currentBody)}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied === "body" ? "コピーしました" : "本文をコピー"}
              </button>
            </div>
          </div>
          <textarea
            rows={14}
            value={currentBody}
            onChange={(e) => setCurrentBody(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs leading-relaxed text-gray-900 font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="text-[11px] text-gray-400">
            ※ 本文内のURLは自動的にリンクとして送信されます。
          </p>
        </div>
      </div>
    </details>
  );
}
