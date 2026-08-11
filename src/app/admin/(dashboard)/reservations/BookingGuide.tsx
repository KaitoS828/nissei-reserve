"use client";

import { useState } from "react";

// 手動予約でもそのまま送れるよう、本文をまるごとコピーできるようにする。
export function BookingGuide({ subject, body }: { subject: string; body: string }) {
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
