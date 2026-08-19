import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCheckInTime } from "@/lib/reservations";
import type { ReservationWithRefs, AdminLink } from "@/types/db";

export const dynamic = "force-dynamic";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

const DEFAULT_LINKS: AdminLink[] = [
  {
    id: "default-1",
    title: "Airbnb ホスト管理",
    url: "https://www.airbnb.jp/hosting",
    category: "OTA・予約サイト",
    description: "予約一覧、メッセージ対応、料金管理",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-2",
    title: "楽天 Vacation STAY",
    url: "https://vacation-stay.jp/manage/listings",
    category: "OTA・予約サイト",
    description: "楽天Vacation STAYの在庫・予約管理",
    sort_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-3",
    title: "Stripe ダッシュボード",
    url: "https://dashboard.stripe.com/",
    category: "決済・インフラ",
    description: "売上金・クレジットカード決済履歴",
    sort_order: 3,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "default-4",
    title: "SwitchBot Web管理",
    url: "https://app.switch-bot.com/",
    category: "スマートロック",
    description: "玄関スマートロック施錠状態",
    sort_order: 4,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

export default async function DashboardPage() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  const today = todayStr();
  const supabase = createAdminClient();

  const sel = "*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name)";
  const [checkInsRes, checkOutsRes, openInquiriesRes, upcomingRes, linksRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(sel)
      .eq("check_in", today)
      .in("status", ["pending", "confirmed", "checked_in"])
      .order("created_at"),
    supabase
      .from("reservations")
      .select(sel)
      .eq("check_out", today)
      .in("status", ["confirmed", "checked_in", "checked_out"])
      .order("created_at"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("reservations")
      .select(sel)
      .gte("check_in", today)
      .in("status", ["pending", "confirmed"])
      .order("check_in")
      .limit(20),
    supabase
      .from("admin_links")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6),
  ]);

  const checkIns = (checkInsRes.data ?? []) as ReservationWithRefs[];
  const checkOuts = (checkOutsRes.data ?? []) as ReservationWithRefs[];
  const upcoming = (upcomingRes.data ?? []) as ReservationWithRefs[];
  const links = (linksRes.data && linksRes.data.length > 0) ? (linksRes.data as AdminLink[]) : DEFAULT_LINKS;
  const revenue = checkIns.reduce((s, r) => s + (r.amount ?? 0), 0);

  const cards = [
    { label: "本日チェックイン", value: `${checkIns.length}件`, href: "/admin/reservations" },
    { label: "本日チェックアウト", value: `${checkOuts.length}件`, href: "/admin/reservations" },
    { label: "本日チェックイン分の売上", value: `¥${revenue.toLocaleString()}`, href: "/admin/payments" },
    { label: "未対応の問合せ", value: `${openInquiriesRes.count ?? 0}件`, href: "/admin/reservations" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-600">{today}・{user?.email}</p>
        </div>
        <Link href="/admin/reservations" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          ＋ 予約を登録
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300">
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-700">{c.value}</p>
          </Link>
        ))}
      </section>

      {/* 予定しているチェックイン */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-gray-900">予定しているチェックイン</h2>
          <Link href="/admin/calendar" className="text-xs text-cyan-700 hover:underline">カレンダーで見る →</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">今後の予約はありません</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-cyan-50 px-2 py-1 font-mono text-xs text-cyan-700">
                    {r.check_in} {formatCheckInTime(r.check_in_time)}
                  </span>
                  <span className="font-medium text-gray-900">{custName(r.customers)}</span>
                  {r.status === "pending" && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">仮予約</span>
                  )}
                </div>
                <span className="text-gray-600">
                  {r.nights}泊 / {r.num_guests}名 / {r.plans?.name ?? "—"}
                  {r.rooms ? ` / ${r.rooms.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium text-gray-900">本日チェックイン</h2>
          {checkIns.length === 0 ? (
            <p className="text-sm text-gray-500">予定なし</p>
          ) : (
            <ul className="space-y-2">
              {checkIns.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{formatCheckInTime(r.check_in_time)}</span>
                    <span className="text-gray-800">{custName(r.customers)}</span>
                  </span>
                  <span className="text-gray-600">{r.room_types?.name ?? "—"}{r.rooms ? ` ${r.rooms.name}` : ""} / {r.num_guests}名</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium text-gray-900">本日チェックアウト</h2>
          {checkOuts.length === 0 ? (
            <p className="text-sm text-gray-500">予定なし</p>
          ) : (
            <ul className="space-y-2">
              {checkOuts.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800">{custName(r.customers)}</span>
                  <span className="text-gray-600">{r.room_types?.name ?? "—"}{r.rooms ? ` ${r.rooms.name}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 各種リンク・管理ショートカット */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-medium text-gray-900">各種リンク・管理ショートカット</h2>
            <p className="text-xs text-gray-500">外部の管理画面やよく使うページへワンタッチでアクセスできます</p>
          </div>
          <Link href="/admin/links" className="text-xs font-medium text-cyan-700 hover:underline">
            リンク管理・追加 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 transition hover:border-cyan-400 hover:bg-white hover:shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-200">
                    {link.category}
                  </span>
                  <span className="text-xs text-cyan-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition">
                    ↗
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-cyan-800">
                  {link.title}
                </p>
                {link.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {link.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
