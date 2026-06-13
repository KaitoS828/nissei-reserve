"use client";

import { useEffect, useRef, useState } from "react";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(defaultValue) ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const year = view.getFullYear();
  const month0 = view.getMonth();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leading = new Date(year, month0, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shiftMonth = (delta: number) => setView(new Date(year, month0 + delta, 1));

  return (
    <div className="relative space-y-1" ref={ref}>
      <span className="text-xs text-gray-400">{label}</span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex items-center justify-between text-left`}
      >
        <span className={value ? "text-white" : "text-gray-500"}>{value || "日付を選択"}</span>
        <span className="text-gray-400">📅</span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 text-gray-300 hover:bg-gray-800">←</button>
            <span className="text-sm font-medium text-white">{year}年{month0 + 1}月</span>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded px-2 py-1 text-gray-300 hover:bg-gray-800">→</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {WEEK.map((w, i) => (
              <div key={w} className={`py-1 text-center text-[10px] ${i === 0 ? "text-red-400" : i === 6 ? "text-cyan-400" : "text-gray-500"}`}>{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const ds = ymd(new Date(year, month0, d));
              const selected = ds === value;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setValue(ds);
                    setOpen(false);
                  }}
                  className={`rounded py-1 text-center text-xs transition ${
                    selected ? "bg-cyan-500 text-gray-950" : "text-gray-200 hover:bg-gray-800"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
