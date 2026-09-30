"use client";

import { useEffect, useState } from "react";

type Section = { id: string; title: string; node: React.ReactNode };
type Layout = { order: string[]; hidden: string[] };

const KEY = "admin-dashboard-layout";

function load(): Layout | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && Array.isArray(v.order) && Array.isArray(v.hidden)) return v;
  } catch {}
  return null;
}

// 表示する項目と並び順は、使う人ごとにこのブラウザに保存する
export function DashboardSections({ sections }: { sections: Section[] }) {
  const defaults = sections.map((s) => s.id);
  const [layout, setLayout] = useState<Layout>({ order: defaults, hidden: [] });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = load();
    if (saved) setLayout(saved);
  }, []);

  function update(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }

  // 保存後に項目が増えた場合も末尾に出す
  const order = [...layout.order.filter((id) => defaults.includes(id)), ...defaults.filter((id) => !layout.order.includes(id))];
  const byId = new Map(sections.map((s) => [s.id, s]));

  function move(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    update({ ...layout, order: next });
  }

  function toggle(id: string) {
    update({
      order,
      hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          {editing ? "編集を終える" : "表示する項目を変更"}
        </button>
      </div>

      {editing && (
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-300 bg-white">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <label className="flex flex-1 items-center gap-2 text-gray-900">
                <input type="checkbox" checked={!layout.hidden.includes(id)} onChange={() => toggle(id)} className="h-4 w-4" />
                {byId.get(id)?.title}
              </label>
              <button
                type="button"
                onClick={() => move(id, -1)}
                disabled={i === 0}
                aria-label="上へ"
                className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(id, 1)}
                disabled={i === order.length - 1}
                aria-label="下へ"
                className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          ))}
        </ul>
      )}

      {order
        .filter((id) => !layout.hidden.includes(id))
        .map((id) => (
          <div key={id}>{byId.get(id)?.node}</div>
        ))}
    </div>
  );
}
