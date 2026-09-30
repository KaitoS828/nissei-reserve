"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type NavGroup = { group: string; items: { href: string; label: string }[] };
type Hit = { code: string; check_in: string; check_out: string; status: string; name: string };

const STATUS: Record<string, string> = {
  pending: "仮予約",
  confirmed: "確定",
  checked_in: "滞在中",
  checked_out: "退室済",
  cancelled: "キャンセル",
  no_show: "無断不泊",
};

type Result = { key: string; href: string; title: string; sub: string };

const OPEN_EVENT = "admin-search:open";

// サイドバー・モバイルバーのどちらからでも開けるよう、ボタンとモーダルを分けている
export function SearchTrigger({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className} aria-label="検索・ページ移動">
      {children}
    </button>
  );
}

export function AdminSearch({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setHits(Array.isArray(d.reservations) ? d.reservations : []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const needle = q.trim().toLowerCase();
  const pages: Result[] = groups
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .filter((i) => !needle || i.label.toLowerCase().includes(needle))
    .slice(0, needle ? 6 : 8)
    .map((i) => ({ key: `p:${i.href}`, href: i.href, title: i.label, sub: i.group }));
  const reservations: Result[] = hits.map((h) => ({
    key: `r:${h.code}`,
    href: `/admin/reservations?q=${encodeURIComponent(h.code)}`,
    title: `${h.name || "（無名）"}　${h.check_in} → ${h.check_out}`,
    sub: `${STATUS[h.status] ?? h.status}・${h.code}`,
  }));
  const results = [...reservations, ...pages];

  function go(r: Result | undefined) {
    if (!r) return;
    setOpen(false);
    router.push(r.href);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-gray-900/40 p-4 pt-[12vh]">
          <button type="button" aria-label="閉じる" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-2xl">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  go(results[cursor]);
                }
              }}
              placeholder="お客様の名前・予約番号・メール、またはページ名"
              className="w-full border-b border-gray-200 px-4 py-3.5 text-base text-gray-900 outline-none"
            />
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-4 text-sm text-gray-600">見つかりませんでした</li>}
              {results.map((r, i) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => go(r)}
                    onMouseEnter={() => setCursor(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                      i === cursor ? "bg-cyan-50 text-cyan-900" : "text-gray-900"
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{r.title}</span>
                    <span className="shrink-0 text-xs text-gray-600">{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
