"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { calcPrice, guestRange, nightlyRateForGuests, type Discount, type GuestPrices } from "@/lib/pricing";

type Plan = {
  id: string;
  name: string;
  tags: string[];
  pricePerNight: number;
  guestPrices: GuestPrices;
  discounts: Discount[];
};

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayStr() {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
}
function addDayStr(s: string, days: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function nightsBetween(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  while (cur < to) {
    out.push(cur);
    cur = addDayStr(cur, 1);
  }
  return out;
}

export function ReserveCalendar({
  plans,
  roomTypeId,
  maxGuests = 6,
  roomLabel = "日靜（1日1組限定）",
}: {
  plans: Plan[];
  roomTypeId: string;
  maxGuests?: number;
  roomLabel?: string;
}) {
  const today = todayStr();
  const now = new Date();
  const minMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [avail, setAvail] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [baseYear, setBaseYear] = useState(now.getFullYear());
  const [baseMonth, setBaseMonth] = useState(now.getMonth());

  useEffect(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 13, 1);
    const toDate = ymd(end.getFullYear(), end.getMonth(), end.getDate());
    fetch(`/api/availability?roomType=${roomTypeId}&from=${today}&to=${toDate}`)
      .then((r) => r.json())
      .then((d) => {
        setAvail(d.availability ?? {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId]);

  const nights = from && to ? nightsBetween(from, to).length : 0;

  const isBooked = (date: string) => loaded && (avail[date] ?? 1) <= 0;
  const disabled = (date: string) => date < today || isBooked(date);

  function onClickDay(date: string) {
    if (disabled(date)) return;
    if (!from || (from && to)) {
      setFrom(date);
      setTo(null);
      return;
    }
    if (date <= from) {
      setFrom(date);
      return;
    }
    const ok = nightsBetween(from, date).every((n) => (avail[n] ?? 1) > 0);
    if (ok) setTo(date);
    else {
      setFrom(date);
      setTo(null);
    }
  }

  const inRange = (date: string) =>
    from && to ? date > from && date < to : false;

  function shift(delta: number) {
    const d = new Date(baseYear, baseMonth + delta, 1);
    const clamped = d < minMonth ? minMonth : d;
    setBaseYear(clamped.getFullYear());
    setBaseMonth(clamped.getMonth());
  }
  const atMin = baseYear === minMonth.getFullYear() && baseMonth === minMonth.getMonth();

  // 当月のセル
  const firstWeekday = new Date(baseYear, baseMonth, 1).getDay();
  const daysInMonth = new Date(baseYear, baseMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  query.set("guests", String(guests));

  const navBtn =
    "rounded-lg px-2.5 py-1 text-xs text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="space-y-4">
      {/* カレンダー */}
      <div className="rounded-2xl border border-gray-200 p-4 shadow-sm sm:p-6">
        {/* ナビ: 前年/前月  月  翌月/翌年 */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-12)} disabled={atMin} className={navBtn} aria-label="前の年">
              « 前年
            </button>
            <button onClick={() => shift(-1)} disabled={atMin} className={navBtn} aria-label="前の月">
              ‹ 前月
            </button>
          </div>
          <span className="text-base font-semibold text-gray-900 sm:text-lg">
            {baseYear}年{baseMonth + 1}月
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(1)} className={navBtn} aria-label="次の月">
              翌月 ›
            </button>
            <button onClick={() => shift(12)} className={navBtn} aria-label="次の年">
              翌年 »
            </button>
          </div>
        </div>
        <p className="mb-3 text-center text-xs text-gray-400">
          空いている日をタップして宿泊期間を選択
        </p>

        {/* 曜日 */}
        <div className="grid grid-cols-7 text-center text-xs text-gray-400">
          {WEEK.map((w, i) => (
            <div key={w} className={i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}>
              {w}
            </div>
          ))}
        </div>
        {/* 日 */}
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const date = ymd(baseYear, baseMonth, d);
            const off = disabled(date);
            const sel = date === from || date === to;
            const range = inRange(date);
            return (
              <div key={i} className="flex justify-center py-0.5">
                <button
                  disabled={off}
                  onClick={() => onClickDay(date)}
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm transition sm:h-11 sm:w-11",
                    off
                      ? "cursor-not-allowed text-gray-300 line-through decoration-gray-300"
                      : "text-gray-800 hover:bg-teal-50 active:bg-teal-100",
                    sel ? "bg-teal-600 font-bold text-white hover:bg-teal-600" : "",
                    range ? "bg-teal-100" : "",
                  ].join(" ")}
                >
                  {d}
                </button>
              </div>
            );
          })}
        </div>

        {/* 凡例 */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs">
          <span className="flex items-center gap-1 text-gray-500">
            <span className="inline-block h-3 w-3 rounded-full bg-teal-600" /> 選択中
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <span className="inline-block h-3 w-3 rounded-full border border-gray-300" /> 空室あり
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <span className="inline-block h-3 w-3 rounded-full bg-gray-100" /> 満室・予約不可
          </span>
        </div>
      </div>

      {/* 選択状況（スティッキー風に見やすく） */}
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-sm">
            <span className="text-gray-500">IN</span>{" "}
            <span className="font-semibold text-gray-900">{from ?? "—"}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">OUT</span>{" "}
            <span className="font-semibold text-gray-900">{to ?? "—"}</span>
          </div>
          {nights > 0 && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-sm text-teal-700">{nights}泊</span>}
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-500">人数</span>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2 py-1"
            >
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}名</option>
              ))}
            </select>
          </label>
          {(from || to) && (
            <button
              onClick={() => { setFrom(null); setTo(null); }}
              className="text-sm text-gray-400 hover:text-gray-700"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* プラン */}
      <div className="space-y-4">
        {plans.map((p) => {
          const { min: planMin } = guestRange(p.guestPrices, maxGuests);
          const belowMin = guests < planMin;
          const effGuests = Math.max(guests, planMin);
          const nightly = nightlyRateForGuests(effGuests, p.guestPrices, p.pricePerNight);
          const perPerson = Math.round(nightly / effGuests);
          const price = from && to && !belowMin ? calcPrice(from, to, nightly, p.discounts) : null;
          return (
            <div key={p.id} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="space-y-2 border-b border-gray-100 pb-4">
                <h2 className="text-lg font-semibold text-gray-900">{p.name}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">{roomLabel}</p>
                  {belowMin ? (
                    <>
                      <p className="mt-1 text-xs text-gray-500">{planMin}名〜{maxGuests}名でご利用可</p>
                      <p className="text-xl font-bold text-gray-900">¥{perPerson.toLocaleString()}/人〜</p>
                      <p className="mt-0.5 text-xs text-amber-600">このプランは最低{planMin}名からです</p>
                    </>
                  ) : price ? (
                    <>
                      <p className="mt-1 text-xs text-gray-500">
                        {price.nights}泊・税サービス料込
                        {price.discountRate > 0 && (
                          <span className="ml-1 text-teal-700">（長期割{Math.round(price.discountRate * 100)}%適用）</span>
                        )}
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {price.discountRate > 0 && (
                          <span className="mr-2 text-sm font-normal text-gray-400 line-through">¥{price.subtotal.toLocaleString()}</span>
                        )}
                        ¥{price.total.toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-gray-500">{guests}名・1泊 合計 ¥{nightly.toLocaleString()}</p>
                      <p className="text-xl font-bold text-gray-900">¥{perPerson.toLocaleString()}/人〜</p>
                    </>
                  )}
                </div>
                {belowMin ? (
                  <span className="rounded-full bg-gray-200 px-6 py-2.5 text-center text-sm font-medium text-gray-500">
                    最低{planMin}名から
                  </span>
                ) : from && to ? (
                  <Link
                    href={`/reserve/${p.id}?${query.toString()}`}
                    className="rounded-full bg-teal-600 px-6 py-2.5 text-center text-sm font-medium text-white transition hover:bg-teal-500"
                  >
                    この日程で予約する
                  </Link>
                ) : (
                  <span className="rounded-full bg-gray-200 px-6 py-2.5 text-center text-sm font-medium text-gray-500">
                    日程を選択
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
