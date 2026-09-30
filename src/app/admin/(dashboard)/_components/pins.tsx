"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type Pin = { code: string; label: string; sub: string };

const KEY = "admin-pinned-reservations";
const EVENT = "admin-pins:changed";

function read(): Pin[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(pins: Pin[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pins));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function usePins() {
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    const sync = () => setPins(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return pins;
}

export function PinButton({ pin }: { pin: Pin }) {
  const pinned = usePins().some((p) => p.code === pin.code);
  return (
    <button
      type="button"
      onClick={(e) => {
        // <summary> の中に置くので、開閉を起こさない
        e.preventDefault();
        e.stopPropagation();
        const cur = read();
        write(pinned ? cur.filter((p) => p.code !== pin.code) : [pin, ...cur.filter((p) => p.code !== pin.code)].slice(0, 12));
      }}
      aria-pressed={pinned}
      aria-label={pinned ? "ダッシュボードのピン留めを外す" : "ダッシュボードにピン留め"}
      title={pinned ? "ピン留めを外す" : "ダッシュボードにピン留め"}
      className={`shrink-0 rounded px-1.5 py-0.5 text-sm transition ${
        pinned ? "bg-amber-100 text-amber-800" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      📌
    </button>
  );
}

export function PinnedReservations() {
  const pins = usePins();
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 font-medium text-gray-900">ピン留めした予約</h2>
      {pins.length === 0 ? (
        <p className="text-sm text-gray-600">予約リストの 📌 を押すと、ここに固定されます</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((p) => (
            <li key={p.code} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <Link href={`/admin/reservations?q=${encodeURIComponent(p.code)}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.label}</p>
                <p className="truncate text-xs text-gray-600">{p.sub}</p>
              </Link>
              <PinButton pin={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
