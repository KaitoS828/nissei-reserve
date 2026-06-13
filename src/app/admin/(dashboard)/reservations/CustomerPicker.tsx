"use client";

import { useState } from "react";
import Link from "next/link";

export type CustomerOption = { id: string; label: string };

const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

export function CustomerPicker({ customers }: { customers: CustomerOption[] }) {
  const [mode, setMode] = useState<"existing" | "manual">("existing");

  return (
    <div className="space-y-2 md:col-span-4">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1 text-gray-400">
          <input
            type="radio"
            name="customer_mode"
            value="existing"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
          />
          既存顧客から選択
        </label>
        <label className="flex items-center gap-1 text-gray-400">
          <input
            type="radio"
            name="customer_mode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
          />
          手入力（新規顧客）
        </label>
        <Link href="/admin/customers" className="text-cyan-400 hover:text-cyan-300">
          顧客名簿に追加 →
        </Link>
      </div>

      {mode === "existing" ? (
        <select name="customer_id" className={field} defaultValue="">
          <option value="">（未指定）</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input name="cust_last_name" placeholder="姓 *" className={field} />
          <input name="cust_first_name" placeholder="名 *" className={field} />
          <input name="cust_email" type="email" placeholder="メール（任意）" className={field} />
          <input name="cust_phone" placeholder="電話（任意）" className={field} />
        </div>
      )}
    </div>
  );
}
