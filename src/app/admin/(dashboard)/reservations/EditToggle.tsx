"use client";

import { useState, type ReactNode } from "react";

const btn =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100";

export function EditToggle({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>
          {open ? "編集をやめる" : "編集"}
        </button>
        {actions}
      </div>
      {open && children}
    </div>
  );
}
