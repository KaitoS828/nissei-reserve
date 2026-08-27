"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 print:hidden"
    >
      {label}
    </button>
  );
}
