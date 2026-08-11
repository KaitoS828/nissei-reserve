"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/SubmitButton";

export function SearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(defaultValue);

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        startTransition(() => {
          router.push(query ? `/admin/customers?q=${encodeURIComponent(query)}` : "/admin/customers");
        });
      }}
    >
      <input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="氏名・メール・電話で検索"
        className="w-64 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600"
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 disabled:cursor-progress disabled:opacity-60"
      >
        {pending && <Spinner />}
        検索
      </button>
    </form>
  );
}
