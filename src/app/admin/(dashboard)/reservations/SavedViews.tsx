"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type View = { name: string; qs: string };

const KEY = "admin-reservation-views";

function read(): View[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// よく使う絞り込みを名前を付けて保存する。保存先はこのブラウザ（端末ごと）。
export function SavedViews({ currentQs }: { currentQs: string }) {
  const [views, setViews] = useState<View[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => setViews(read()), []);

  function persist(next: View[]) {
    setViews(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }

  const alreadySaved = views.some((v) => v.qs === currentQs);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((v) => (
        <span
          key={v.qs}
          className={`inline-flex items-center overflow-hidden rounded-full border text-sm ${
            v.qs === currentQs ? "border-cyan-600 bg-cyan-50 text-cyan-900" : "border-gray-300 bg-white text-gray-800"
          }`}
        >
          <Link href={`/admin/reservations${v.qs ? `?${v.qs}` : ""}`} className="px-3 py-1.5 hover:bg-gray-100">
            {v.name}
          </Link>
          <button
            type="button"
            onClick={() => persist(views.filter((x) => x.qs !== v.qs))}
            aria-label={`${v.name} を削除`}
            className="px-2 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            ✕
          </button>
        </span>
      ))}

      {currentQs && !alreadySaved && !naming && (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="rounded-full border border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:border-cyan-600 hover:text-cyan-800"
        >
          ＋ この絞り込みを保存
        </button>
      )}
      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            persist([...views, { name: n, qs: currentQs }]);
            setName("");
            setNaming(false);
          }}
          className="flex items-center gap-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前（例: 今月のキャンセル）"
            maxLength={20}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-cyan-600"
          />
          <button type="submit" className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700">
            保存
          </button>
          <button type="button" onClick={() => setNaming(false)} className="text-sm text-gray-700 hover:underline">
            やめる
          </button>
        </form>
      )}
    </div>
  );
}
