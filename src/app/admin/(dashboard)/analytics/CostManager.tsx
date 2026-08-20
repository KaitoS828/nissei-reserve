"use client";

import { useState } from "react";
import Link from "next/link";
import type { OperatingCost } from "@/types/db";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  saveBaseMonthlyCosts,
  createOperatingCost,
  createBulkOperatingCosts,
  updateOperatingCost,
  deleteOperatingCost,
} from "./actions";

const BASE_CATEGORIES = ["家賃", "電気代", "ガス代", "水道代", "Wi-Fi通信費"];

export const DEFAULT_VARIABLE_CATEGORIES = [
  "清掃・リネン費",
  "消耗品・アメニティ",
  "システム利用料・手数料",
  "施設維持・修繕費",
  "広告宣伝・集客費",
  "人件費・外注費",
  "通信・事務用品費",
  "その他経費",
];

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";
const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50";

function EditCostRow({
  cost,
  allCategories,
  onCancel,
}: {
  cost: OperatingCost;
  allCategories: string[];
  onCancel: () => void;
}) {
  const isPresetCategory = allCategories.includes(cost.category);
  const [isCustomMode, setIsCustomMode] = useState(!isPresetCategory);
  const [selectedCat, setSelectedCat] = useState(
    isPresetCategory ? cost.category : allCategories[0] ?? DEFAULT_VARIABLE_CATEGORIES[0]
  );
  const [customCat, setCustomCat] = useState(isPresetCategory ? "" : cost.category);

  return (
    <tr className="bg-cyan-50/50">
      <td colSpan={7} className="p-3">
        <form action={updateOperatingCost} className="space-y-3">
          <input type="hidden" name="id" value={cost.id} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">年月</span>
              <input
                type="month"
                name="year_month"
                required
                defaultValue={cost.year_month}
                className={field}
              />
            </label>

            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-600">カテゴリ</span>
                <button
                  type="button"
                  onClick={() => setIsCustomMode((m) => !m)}
                  className="text-[10px] text-cyan-700 hover:underline font-medium"
                >
                  {isCustomMode ? "← 一覧から選ぶ" : "＋ 直接入力に切替"}
                </button>
              </div>
              {isCustomMode ? (
                <input
                  type="text"
                  name="category"
                  required
                  value={customCat}
                  onChange={(e) => setCustomCat(e.target.value)}
                  placeholder="カテゴリ名を入力"
                  className={field}
                  autoFocus
                />
              ) : (
                <select
                  name="category"
                  value={selectedCat}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomMode(true);
                    } else {
                      setSelectedCat(e.target.value);
                    }
                  }}
                  className={field}
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__custom__">＋ 新規カテゴリを直接入力...</option>
                </select>
              )}
            </div>

            <label className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">金額（円）</span>
              <input
                type="number"
                name="amount"
                min={0}
                required
                defaultValue={cost.amount}
                className={field}
              />
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">発生日</span>
              <input
                type="date"
                name="recorded_date"
                defaultValue={cost.recorded_date ?? ""}
                className={field}
              />
            </label>

            <div className="flex gap-2">
              <SubmitButton className="rounded bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-700">
                保存
              </SubmitButton>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-600">備考・内容</span>
            <input
              type="text"
              name="description"
              defaultValue={cost.description ?? ""}
              placeholder="備考を入力（任意）"
              className={field}
            />
          </label>
        </form>
      </td>
    </tr>
  );
}

type BulkItem = {
  id: string;
  category: string;
  isCustom: boolean;
  amount: string;
  recorded_date: string;
  description: string;
};

export function CostManager({
  costs,
  currentYear,
  currentMonth,
  dbReady = true,
}: {
  costs: OperatingCost[];
  currentYear: string;
  currentMonth: string;
  dbReady?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // 登録モード（1件ずつ / まとめて一括）
  const [formMode, setFormMode] = useState<"single" | "bulk">("single");

  // 単一登録フォーム用 State
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_VARIABLE_CATEGORIES[0]);
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState<boolean>(false);
  const [customCategoryName, setCustomCategoryName] = useState<string>("");

  const isYearly = !currentMonth;

  // 対象年月（月未指定なら現在の月をデフォルト）
  const activeYearMonth = currentMonth
    ? `${currentYear}-${currentMonth}`
    : `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // 一括登録フォーム用 State
  const [bulkMonth, setBulkMonth] = useState<string>(activeYearMonth);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([
    { id: "1", category: DEFAULT_VARIABLE_CATEGORIES[0], isCustom: false, amount: "", recorded_date: "", description: "" },
    { id: "2", category: DEFAULT_VARIABLE_CATEGORIES[1], isCustom: false, amount: "", recorded_date: "", description: "" },
    { id: "3", category: DEFAULT_VARIABLE_CATEGORIES[2], isCustom: false, amount: "", recorded_date: "", description: "" },
  ]);

  const addBulkRow = () => {
    setBulkItems((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        category: DEFAULT_VARIABLE_CATEGORIES[0],
        isCustom: false,
        amount: "",
        recorded_date: "",
        description: "",
      },
    ]);
  };

  const removeBulkRow = (id: string) => {
    setBulkItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const updateBulkItem = (id: string, updates: Partial<BulkItem>) => {
    setBulkItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // 登録済みデータに含まれるカスタムカテゴリ（ベースカテゴリ & デフォルト変動カテゴリ以外）を自動抽出
  const customCategories = Array.from(
    new Set(
      costs
        .map((c) => c.category)
        .filter(
          (cat) =>
            cat &&
            !BASE_CATEGORIES.includes(cat) &&
            !DEFAULT_VARIABLE_CATEGORIES.includes(cat)
        )
    )
  );

  const allAvailableCategories = Array.from(
    new Set([...DEFAULT_VARIABLE_CATEGORIES, ...customCategories])
  );

  // 一括登録用の有効データ計算
  const validBulkRows = bulkItems
    .filter((item) => item.amount !== "" && Number(item.amount) > 0)
    .map((item) => ({
      year_month: bulkMonth,
      category: item.category.trim() || "その他経費",
      amount: Number(item.amount),
      recorded_date: item.recorded_date.trim() || null,
      description: item.description.trim() || null,
    }));

  const bulkTotalAmount = validBulkRows.reduce((sum, r) => sum + r.amount, 0);

  // 現在の年月におけるベースコストの既存値を取得
  const monthCosts = costs.filter((c) => c.year_month === activeYearMonth);
  const getBaseAmount = (cat: string) => {
    const item = monthCosts.find((c) => c.category === cat);
    return item ? String(item.amount) : "";
  };

  const totalCost = costs.reduce((sum, c) => sum + c.amount, 0);
  const baseCostTotal = costs
    .filter((c) => BASE_CATEGORIES.includes(c.category))
    .reduce((sum, c) => sum + c.amount, 0);
  const variableCostTotal = costs
    .filter((c) => !BASE_CATEGORIES.includes(c.category))
    .reduce((sum, c) => sum + c.amount, 0);

  // 通年表示用の月別集計（1月〜12月）
  const monthlySummaries = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${currentYear}-${mm}`;
    const mCosts = costs.filter((c) => c.year_month === ym);
    const mBase = mCosts
      .filter((c) => BASE_CATEGORIES.includes(c.category))
      .reduce((sum, c) => sum + c.amount, 0);
    const mVar = mCosts
      .filter((c) => !BASE_CATEGORIES.includes(c.category))
      .reduce((sum, c) => sum + c.amount, 0);
    const mTotal = mCosts.reduce((sum, c) => sum + c.amount, 0);
    return {
      month: mm,
      label: `${Number(mm)}月`,
      yearMonth: ym,
      base: mBase,
      variable: mVar,
      total: mTotal,
      count: mCosts.length,
      costs: mCosts,
    };
  });

  return (
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              コスト（経費）管理
            </h2>
            {currentMonth ? (
              <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
                {currentYear}年{Number(currentMonth)}月
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {currentYear}年（通年まとめ）
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span>
              {currentMonth ? `${currentYear}年${Number(currentMonth)}月` : `${currentYear}年`}の経費合計:{" "}
              <strong className="text-gray-900 text-sm">¥{totalCost.toLocaleString()}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              固定・インフラ: <strong>¥{baseCostTotal.toLocaleString()}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              変動・個別: <strong>¥{variableCostTotal.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {currentMonth && (
          <Link
            href={`/admin/analytics?year=${currentYear}`}
            className="text-xs font-medium text-cyan-700 hover:underline"
          >
            ← 通年の集計・まとめを見る
          </Link>
        )}

        {!dbReady && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
            ※ コスト管理テーブルの作成が必要です。
          </div>
        )}
      </div>

      {/* --- A. 通年表示（月毎にまとめた一覧 & タップで月別管理へ） --- */}
      {isYearly && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              各月をタップまたは「管理する →」を押すと、その月の経費詳細・固定費入力画面へ移動します。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="py-2.5 px-3">対象月</th>
                  <th className="py-2.5 px-3 text-right">固定・インフラ費</th>
                  <th className="py-2.5 px-3 text-right">変動・個別経費</th>
                  <th className="py-2.5 px-3 text-right">経費合計</th>
                  <th className="py-2.5 px-3 text-center">登録件数</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {monthlySummaries.map((m) => {
                  const hasData = m.count > 0;
                  return (
                    <tr
                      key={m.month}
                      className="hover:bg-cyan-50/40 transition group cursor-pointer"
                      onClick={() => {
                        window.location.href = `/admin/analytics?year=${currentYear}&month=${m.month}`;
                      }}
                    >
                      <td className="py-3 px-3 font-semibold text-gray-900">
                        <Link
                          href={`/admin/analytics?year=${currentYear}&month=${m.month}`}
                          className="group-hover:text-cyan-700 transition"
                        >
                          {currentYear}年{m.label}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-600">
                        {m.base > 0 ? `¥${m.base.toLocaleString()}` : <span className="text-gray-300">¥0</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-600">
                        {m.variable > 0 ? `¥${m.variable.toLocaleString()}` : <span className="text-gray-300">¥0</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-gray-900">
                        {hasData ? (
                          `¥${m.total.toLocaleString()}`
                        ) : (
                          <span className="text-gray-300 font-normal">¥0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasData ? (
                          <span className="inline-block rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">
                            {m.count}件
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">未登録</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/admin/analytics?year=${currentYear}&month=${m.month}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          {m.label}の管理を開く →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- B. 月別表示時、または通年時のクイック入力フォーム --- */}
      {/* 1. ベース費用（家賃・電気代・ガス代・水道代・Wi-Fi）一括入力フォーム */}
      <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-cyan-900">
              {currentMonth ? `${currentYear}年${Number(currentMonth)}月のベース費用（家賃・光熱費・水道・Wi-Fi）` : "毎月のベース費用（家賃・光熱費・水道・Wi-Fi）"}
            </h3>
            <p className="text-xs text-cyan-700 mt-0.5">
              家賃と光熱費・通信費を一括で入力・更新できます。
            </p>
          </div>
        </div>

        <form action={saveBaseMonthlyCosts} className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-700 shrink-0">対象年月:</span>
            {currentMonth ? (
              <>
                <span className="rounded-md bg-cyan-100/80 border border-cyan-200 px-2.5 py-1 text-xs font-bold text-cyan-900">
                  {currentYear}年{Number(currentMonth)}月
                </span>
                <input type="hidden" name="year_month" value={activeYearMonth} />
              </>
            ) : (
              <input
                type="month"
                name="year_month"
                required
                defaultValue={activeYearMonth}
                className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* 家賃 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">家賃</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  name="rent"
                  min={0}
                  placeholder="0"
                  defaultValue={getBaseAmount("家賃")}
                  className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 電気代 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">電気代</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  name="electricity"
                  min={0}
                  placeholder="0"
                  defaultValue={getBaseAmount("電気代")}
                  className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* ガス代 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">ガス代</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  name="gas"
                  min={0}
                  placeholder="0"
                  defaultValue={getBaseAmount("ガス代")}
                  className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 水道代 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">水道代</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  name="water"
                  min={0}
                  placeholder="0"
                  defaultValue={getBaseAmount("水道代")}
                  className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Wi-Fi通信費 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">Wi-Fi通信費</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  name="wifi"
                  min={0}
                  placeholder="0"
                  defaultValue={getBaseAmount("Wi-Fi通信費")}
                  className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <SubmitButton className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800 shadow-sm">
              ベース費用を一括保存
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* 2. 個別の変動経費（清掃費、消耗品、修繕など）追加フォーム */}
      <details className="rounded-xl border border-gray-200 bg-gray-50/70 p-4" open={!isYearly}>
        <summary className="cursor-pointer font-medium text-sm text-gray-800 hover:text-cyan-800 flex items-center justify-between">
          <span>＋ 個別の経費を追加（清掃費・消耗品・アメニティ・修繕費など）</span>
          <span className="text-xs text-gray-500 font-normal">1件追加 / まとめて一括登録</span>
        </summary>

        {/* 登録モード切り替えタブ */}
        <div className="mt-3.5 flex items-center gap-2 border-b border-gray-200/80 pb-2.5">
          <button
            type="button"
            onClick={() => setFormMode("single")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              formMode === "single"
                ? "bg-cyan-700 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            1件ずつ登録
          </button>
          <button
            type="button"
            onClick={() => setFormMode("bulk")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              formMode === "bulk"
                ? "bg-cyan-700 text-white shadow-xs"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>まとめて一括登録（複数行）</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              formMode === "bulk" ? "bg-cyan-800 text-cyan-100" : "bg-cyan-100 text-cyan-800"
            }`}>便利</span>
          </button>
        </div>

        {formMode === "single" ? (
          <div>
            {/* クイック選択タグ */}
            <div className="mt-3 pt-1">
              <div className="text-[11px] font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <span>よく使うカテゴリを選択:</span>
                <span className="text-gray-400 font-normal">（クリックで選択されます）</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DEFAULT_VARIABLE_CATEGORIES.map((cat) => {
                  const isSelected = !isCustomCategoryMode && selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setIsCustomCategoryMode(false);
                        setSelectedCategory(cat);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-cyan-50 hover:text-cyan-800 hover:border-cyan-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
                {customCategories.map((cat) => {
                  const isSelected = !isCustomCategoryMode && selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setIsCustomCategoryMode(false);
                        setSelectedCategory(cat);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-cyan-50 hover:text-cyan-800 hover:border-cyan-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustomCategoryMode(true)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    isCustomCategoryMode
                      ? "bg-cyan-600 text-white shadow-xs"
                      : "bg-white text-cyan-700 border border-dashed border-cyan-300 hover:bg-cyan-50"
                  }`}
                >
                  ＋ 新しいカテゴリを直接入力
                </button>
              </div>
            </div>

            <form action={createOperatingCost} className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 ${isYearly ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
              {isYearly ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">対象年月 *</span>
                  <input
                    type="month"
                    name="year_month"
                    required
                    defaultValue={activeYearMonth}
                    className={field}
                  />
                </label>
              ) : (
                <input type="hidden" name="year_month" value={activeYearMonth} />
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">項目・カテゴリ *</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategoryMode((m) => !m)}
                    className="text-[11px] text-cyan-700 hover:underline font-medium cursor-pointer"
                  >
                    {isCustomCategoryMode ? "← 一覧から選ぶ" : "＋ 直接入力"}
                  </button>
                </div>
                {isCustomCategoryMode ? (
                  <input
                    type="text"
                    name="category"
                    required
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="例: 害虫駆除費、備品購入など"
                    className={field}
                    autoFocus
                  />
                ) : (
                  <select
                    name="category"
                    value={selectedCategory}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomCategoryMode(true);
                      } else {
                        setSelectedCategory(e.target.value);
                      }
                    }}
                    className={field}
                  >
                    <optgroup label="主要カテゴリ">
                      {DEFAULT_VARIABLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="過去に登録したカテゴリ">
                        {customCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__custom__">＋ 新規カテゴリを直接入力...</option>
                  </select>
                )}
              </div>

              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">金額（円） *</span>
                <input
                  type="number"
                  name="amount"
                  min={0}
                  required
                  placeholder="15000"
                  className={field}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">発生・支払日（任意）</span>
                <input
                  type="date"
                  name="recorded_date"
                  className={field}
                />
              </label>

              <div className="space-y-1 sm:col-span-2 lg:col-span-5 flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <span className="text-xs font-medium text-gray-600">備考・内容（任意）</span>
                  <input
                    type="text"
                    name="description"
                    placeholder="〇〇社 清掃8回分、アメニティ補充など"
                    className={field}
                  />
                </div>
                <SubmitButton className={`${btnPrimary} shrink-0 w-full sm:w-auto`}>
                  経費を追加
                </SubmitButton>
              </div>
            </form>
          </div>
        ) : (
          /* 一括登録フォーム */
          <form action={createBulkOperatingCosts} className="mt-3 space-y-4">
            <input type="hidden" name="items_json" value={JSON.stringify(validBulkRows)} />

            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 shrink-0">対象年月:</span>
                {isYearly ? (
                  <input
                    type="month"
                    name="year_month"
                    required
                    value={bulkMonth}
                    onChange={(e) => setBulkMonth(e.target.value)}
                    className="w-40 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                  />
                ) : (
                  <>
                    <span className="rounded-md bg-cyan-100/80 border border-cyan-200 px-2.5 py-1 text-xs font-bold text-cyan-900">
                      {currentYear}年{Number(currentMonth)}月
                    </span>
                    <input type="hidden" name="year_month" value={activeYearMonth} />
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  有効入力: <strong className="text-cyan-700">{validBulkRows.length}件</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  一括合計金額: <strong className="text-gray-900 text-sm">¥{bulkTotalAmount.toLocaleString()}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 font-semibold text-gray-600">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">カテゴリ *</th>
                    <th className="py-2.5 px-3 w-36">金額（円） *</th>
                    <th className="py-2.5 px-3 w-36">発生日（任意）</th>
                    <th className="py-2.5 px-3">備考・内容（任意）</th>
                    <th className="py-2.5 px-3 w-16 text-center">削除</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bulkItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-2 px-3 text-center text-gray-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="space-y-1">
                          {item.isCustom ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={item.category}
                                onChange={(e) => updateBulkItem(item.id, { category: e.target.value })}
                                placeholder="カテゴリ名を入力"
                                className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateBulkItem(item.id, { isCustom: false, category: DEFAULT_VARIABLE_CATEGORIES[0] })}
                                className="text-[10px] text-gray-500 hover:text-gray-800 shrink-0 cursor-pointer"
                                title="一覧選択に戻る"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={item.category}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    updateBulkItem(item.id, { isCustom: true, category: "" });
                                  } else {
                                    updateBulkItem(item.id, { category: e.target.value });
                                  }
                                }}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                              >
                                <optgroup label="主要カテゴリ">
                                  {DEFAULT_VARIABLE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </optgroup>
                                {customCategories.length > 0 && (
                                  <optgroup label="過去に登録したカテゴリ">
                                    {customCategories.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <option value="__custom__">＋ 新規直接入力...</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1 text-xs text-gray-400">¥</span>
                          <input
                            type="number"
                            min={0}
                            value={item.amount}
                            onChange={(e) => updateBulkItem(item.id, { amount: e.target.value })}
                            placeholder="0"
                            className="w-full rounded border border-gray-300 pl-5 pr-2 py-1 text-xs text-gray-900 font-semibold focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={item.recorded_date}
                          onChange={(e) => updateBulkItem(item.id, { recorded_date: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateBulkItem(item.id, { description: e.target.value })}
                          placeholder="内容・備考（任意）"
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeBulkRow(item.id)}
                          disabled={bulkItems.length <= 1}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="行を削除"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={addBulkRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs cursor-pointer"
              >
                <span>＋ 行を追加する</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  ※ 金額が入力された行（1円以上）のみ一括登録されます
                </span>
                <SubmitButton
                  disabled={validBulkRows.length === 0}
                  className={`${btnPrimary} ${validBulkRows.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {validBulkRows.length > 0
                    ? `${validBulkRows.length}件の経費を一括登録（計 ¥${bulkTotalAmount.toLocaleString()}）`
                    : "経費を一括登録"}
                </SubmitButton>
              </div>
            </div>
          </form>
        )}
      </details>

      {/* 3. 登録済みコスト一覧（月別表示時はその月の明細、通年時は明細アコーディオン） */}
      {!isYearly ? (
        costs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="py-2.5 px-3">対象年月</th>
                  <th className="py-2.5 px-3">区分</th>
                  <th className="py-2.5 px-3">項目</th>
                  <th className="py-2.5 px-3 text-right">金額</th>
                  <th className="py-2.5 px-3">発生日</th>
                  <th className="py-2.5 px-3">備考</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {costs.map((c) => {
                  const isBase = BASE_CATEGORIES.includes(c.category);

                  if (editingId === c.id) {
                    return (
                      <EditCostRow
                        key={c.id}
                        cost={c}
                        allCategories={allAvailableCategories}
                        onCancel={() => setEditingId(null)}
                      />
                    );
                  }

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{c.year_month}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          isBase ? "bg-cyan-100 text-cyan-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {isBase ? "固定・インフラ" : "変動・個別"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        {c.category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                        ¥{c.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {c.recorded_date ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-600 truncate max-w-xs" title={c.description ?? ""}>
                        {c.description ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(c.id)}
                            className="text-xs text-cyan-700 hover:underline cursor-pointer"
                          >
                            編集
                          </button>
                          <form action={deleteOperatingCost} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="year" value={currentYear} />
                            <input type="hidden" name="month" value={currentMonth} />
                            <ConfirmButton
                              danger
                              title="コストを削除します"
                              message={`「${c.year_month} / ${c.category} (¥${c.amount.toLocaleString()})」を削除します。よろしいですか？`}
                              confirmLabel="削除する"
                              className="text-xs text-red-600 hover:underline cursor-pointer"
                            >
                              削除
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-6 text-xs text-gray-400">
            この月に登録されたコスト（経費）はありません。上のフォームから登録できます。
          </p>
        )
      ) : null}
    </div>
  );
}
