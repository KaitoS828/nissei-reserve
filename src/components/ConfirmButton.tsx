"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "./SubmitButton";

// お客様に直接影響する操作（メール送信・ドアPINの発行と無効化など）は、
// 押しただけで実行しない。必ず一度確認を挟む。
// ブラウザ標準の confirm は使わない（画面が固まり、自動テストも止まるため）。

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <div className="text-sm text-gray-600">{message}</div>
        <div className="space-y-2">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white disabled:cursor-progress disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-gray-700"
            }`}
          >
            {pending && <Spinner />}
            {pending ? "処理中です…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmButton({
  children,
  className = "",
  title,
  message,
  confirmLabel,
  danger,
  hidden,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** フォームに一緒に送りたい値（name → value） */
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <button ref={ref} type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <ConfirmDialog
          title={title}
          message={message}
          confirmLabel={confirmLabel}
          danger={danger}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
