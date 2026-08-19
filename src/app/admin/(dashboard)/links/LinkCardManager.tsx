"use client";

import { useState } from "react";
import type { AdminLink } from "@/types/db";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { saveAdminLink, deleteAdminLink } from "./actions";

const CATEGORIES = [
  "すべて",
  "OTA・予約サイト",
  "決済・インフラ",
  "スマートロック・IoT",
  "集客・SNS",
  "公式・自社",
  "その他",
];

const PRESET_CATEGORIES = [
  "OTA・予約サイト",
  "決済・インフラ",
  "スマートロック・IoT",
  "集客・SNS",
  "公式・自社",
  "その他",
];

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600 focus:bg-white";

export function LinkCardManager({ links }: { links: AdminLink[] }) {
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLink, setEditingLink] = useState<AdminLink | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filtered = links.filter((link) => {
    const matchCat =
      selectedCategory === "すべて" || link.category === selectedCategory;
    const matchQuery =
      !searchQuery.trim() ||
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.description &&
        link.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* 検索 & フィルタ & 新規追加ボタン */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* カテゴリタブ */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                selectedCategory === cat
                  ? "bg-cyan-700 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="リンクを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-cyan-600"
          />
          <button
            type="button"
            onClick={() => {
              setEditingLink(null);
              setIsCreating(true);
            }}
            className="shrink-0 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 shadow-sm"
          >
            ＋ リンクを追加
          </button>
        </div>
      </div>

      {/* リンクカードグリッド */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-600">登録されているリンクがありません</p>
          <p className="mt-1 text-xs text-gray-400">
            「＋ リンクを追加」ボタンからよく使う管理画面や外部サイトのURLを登録できます。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((link) => (
            <div
              key={link.id}
              className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                link.is_active ? "border-gray-200 hover:border-cyan-400" : "border-gray-200 bg-gray-50/70 opacity-60"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    {link.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingLink(link);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-xs"
                      title="編集"
                    >
                      編集
                    </button>
                    <form action={deleteAdminLink}>
                      <input type="hidden" name="id" value={link.id} />
                      <input type="hidden" name="title" value={link.title} />
                      <ConfirmButton
                        title="リンクの削除"
                        message={`「${link.title}」を削除しますか？`}
                        confirmLabel="削除する"
                        danger
                        className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 text-xs"
                      >
                        削除
                      </ConfirmButton>
                    </form>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-cyan-800 transition">
                    {link.title}
                  </h3>
                  {link.description && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {link.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="font-mono text-[11px] text-gray-600 truncate max-w-[180px]">
                  {link.url.replace(/^https?:\/\//, "")}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-600 hover:text-white"
                >
                  開く ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規登録 / 編集モーダル */}
      {(isCreating || editingLink) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-900">
                {editingLink ? "リンクを編集" : "新しいリンクを追加"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingLink(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form action={saveAdminLink} className="space-y-3.5">
              {editingLink && <input type="hidden" name="id" value={editingLink.id} />}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-700">タイトル（名称）*</span>
                <input
                  name="title"
                  required
                  placeholder="例: Airbnb ホスト管理"
                  defaultValue={editingLink?.title ?? ""}
                  className={field}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-700">URL *</span>
                <input
                  name="url"
                  type="url"
                  required
                  placeholder="https://..."
                  defaultValue={editingLink?.url ?? ""}
                  className={field}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-gray-700">カテゴリ</span>
                  <select
                    name="category"
                    defaultValue={editingLink?.category ?? "OTA・予約サイト"}
                    className={field}
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-gray-700">表示順（小さい順）</span>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={editingLink?.sort_order ?? 0}
                    className={field}
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-700">説明・メモ（任意）</span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="例: 予約一覧、メッセージ対応、料金設定"
                  defaultValue={editingLink?.description ?? ""}
                  className={field}
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingLink(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <SubmitButton className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700">
                  {editingLink ? "更新する" : "登録する"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
