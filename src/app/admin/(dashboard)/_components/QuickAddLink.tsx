"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveAdminLink } from "../links/actions";
import { PRESET_CATEGORIES } from "../links/LinkCardManager";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";

// ダッシュボードから、ページを移らずにリンクを追加する
export function QuickAddLink() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-700"
      >
        ＋ リンクを追加
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4">
          <button type="button" aria-label="閉じる" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-300 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">新しいリンクを追加</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="text-lg leading-none text-gray-600 hover:text-gray-900">
                ✕
              </button>
            </div>
            <form action={saveAdminLink} className="space-y-3.5">
              <input type="hidden" name="return_to" value="/admin" />
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-800">名称 *</span>
                <input name="title" required autoFocus placeholder="例: Airbnb ホスト管理" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-800">URL *</span>
                <input name="url" type="url" required placeholder="https://..." className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-800">カテゴリ</span>
                <select name="category" defaultValue={PRESET_CATEGORIES[0]} className={field}>
                  {PRESET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-800">説明・メモ（任意）</span>
                <input name="description" placeholder="例: 予約一覧、メッセージ対応" className={field} />
              </label>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100">
                  キャンセル
                </button>
                <SubmitButton className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700">
                  登録する
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
