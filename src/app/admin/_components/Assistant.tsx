"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/SubmitButton";

type Msg = { role: "user" | "assistant"; text: string };
type History = unknown[];

const SUGGESTIONS = [
  "今後の予約を教えて",
  "9月10日から12日まで予約不可にして",
  "今日のチェックインは？",
];

export function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [history, setHistory] = useState<History>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setPending(true);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");
      setMsgs((m) => [...m, { role: "assistant", text: data.reply }]);
      setHistory(data.history ?? []);
      // 予約・休業日が変更された可能性があるので、表示中の画面を最新化する
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-cyan-700"
      >
        <span aria-hidden>✨</span> AIアシスタント
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">AIアシスタント</p>
          <p className="text-[11px] text-gray-500">話しかけると予約や休業日を操作します</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100"
          aria-label="閉じる"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">例えばこんなふうに指示できます:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 transition hover:border-cyan-500 hover:bg-cyan-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-cyan-600 text-white"
                : "mr-auto max-w-[90%] bg-gray-100 text-gray-800"
            }`}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <div className="mr-auto flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
            <Spinner /> 考えています…
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-gray-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="指示を入力…"
          disabled={pending}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="shrink-0 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </div>
  );
}
