"use client";

import { useState } from "react";
import Link from "next/link";
import type { OperatingCost } from "@/types/db";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  saveBaseMonthlyCosts,
  createOperatingCost,
  updateOperatingCost,
  deleteOperatingCost,
} from "./actions";

const BASE_CATEGORIES = ["家賃", "電気代", "ガス代", "水道代", "Wi-Fi通信費"];

const DEFAULT_VARIABLE_CATEGORIES = [
  "清掃・リネン費",
  "消耗品・アメニティ",
  "システム利用料・手数料",
  "施設維持・修繕費",
  "広告宣伝費",
  "その他経費",
];

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";
const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50";

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

  const isYearly = !currentMonth;

  // 対象年月（月未指定なら現在の月をデフォルト）
  const activeYearMonth = currentMonth
    ? `${currentYear}-${currentMonth}`
    : `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

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
            <label className="text-xs font-medium text-gray-700 shrink-0">対象年月:</label>
            <input
              type="month"
              name="year_month"
              required
              defaultValue={activeYearMonth}
              className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none"
            />
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
          <span className="text-xs text-gray-500 font-normal">随時追加・登録</span>
        </summary>

        <form action={createOperatingCost} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs text-gray-600">対象年月 *</span>
            <input
              type="month"
              name="year_month"
              required
              defaultValue={activeYearMonth}
              className={field}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-600">項目・カテゴリ *</span>
            <input
              type="text"
              name="category"
              list="cost-categories"
              required
              placeholder="清掃費、消耗品など"
              defaultValue="清掃・リネン費"
              className={field}
            />
            <datalist id="cost-categories">
              {DEFAULT_VARIABLE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-600">金額（円） *</span>
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
            <span className="text-xs text-gray-600">発生・支払日（任意）</span>
            <input
              type="date"
              name="recorded_date"
              className={field}
            />
          </label>

          <div className="space-y-1 sm:col-span-2 lg:col-span-5 flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <span className="text-xs text-gray-600">備考・内容（任意）</span>
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
                      <tr key={c.id} className="bg-cyan-50/50">
                        <td colSpan={7} className="p-3">
                          <form action={updateOperatingCost} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 items-end">
                            <input type="hidden" name="id" value={c.id} />
                            <label className="space-y-1">
                              <span className="text-[11px] text-gray-500">年月</span>
                              <input
                                type="month"
                                name="year_month"
                                required
                                defaultValue={c.year_month}
                                className={field}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-gray-500">項目</span>
                              <input
                                type="text"
                                name="category"
                                required
                                defaultValue={c.category}
                                className={field}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-gray-500">金額</span>
                              <input
                                type="number"
                                name="amount"
                                min={0}
                                required
                                defaultValue={c.amount}
                                className={field}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-gray-500">発生日</span>
                              <input
                                type="date"
                                name="recorded_date"
                                defaultValue={c.recorded_date ?? ""}
                                className={field}
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-gray-500">備考</span>
                              <input
                                type="text"
                                name="description"
                                defaultValue={c.description ?? ""}
                                className={field}
                              />
                            </label>
                            <div className="flex gap-2">
                              <SubmitButton className="rounded bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-700">
                                保存
                              </SubmitButton>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                取消
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
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
                            className="text-xs text-cyan-700 hover:underline"
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
                              className="text-xs text-red-600 hover:underline"
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
