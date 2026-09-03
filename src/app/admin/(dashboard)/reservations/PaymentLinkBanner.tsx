"use client";

import { useState } from "react";

// 決済リンク発行直後にだけ出るバナー。リロードすると消える（リンクはStripe側に残る）。
export function PaymentLinkBanner({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-3">
      <p className="text-sm font-medium text-cyan-900">
        予約 {code} の決済リンクを発行しました。お客様にこのURLを送ってください（24時間有効）。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-cyan-200 bg-white px-2 py-1.5 text-xs text-gray-700"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
        >
          {copied ? "コピーしました" : "URLをコピー"}
        </button>
      </div>
    </div>
  );
}
