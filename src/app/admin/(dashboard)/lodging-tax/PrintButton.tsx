"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
    >
      印刷 / PDF保存
    </button>
  );
}
