"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500 print:hidden"
    >
      PDFで保存・印刷
    </button>
  );
}
