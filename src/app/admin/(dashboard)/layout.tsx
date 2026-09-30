import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./_components/AdminNav";
import { SearchTrigger } from "./_components/AdminSearch";
import { SectionTabs } from "./_components/SectionTabs";
import { Assistant } from "@/app/admin/_components/Assistant";

// 探すときの頭の中の順番に合わせてまとめる。
// 毎日見るもの → 受付の設定 → お金 → めったに触らないマスタ。
const NAV = [
  {
    group: "日々の運用",
    items: [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/calendar", label: "予約カレンダー" },
      { href: "/admin/reservations", label: "予約リスト" },
      { href: "/admin/guests", label: "宿泊者名簿" },
      { href: "/admin/customers", label: "顧客" },
      { href: "/admin/links", label: "各種リンク" },
    ],
  },
  {
    group: "受付の設定",
    items: [
      { href: "/admin/blocked", label: "予約不可" },
      { href: "/admin/ical", label: "iCal連携" },
    ],
  },
  {
    group: "決済・集計",
    items: [
      { href: "/admin/analytics", label: "集計・分析" },
      { href: "/admin/payments", label: "決済" },
    ],
  },
  {
    group: "設定",
    items: [
      { href: "/admin/site-settings", label: "TOPページ設定" },
      { href: "/admin/customize", label: "カスタマイズ" },
      { href: "/admin/masters/plans", label: "宿泊プラン" },
      { href: "/admin/masters/room-types", label: "客室タイプ" },
      { href: "/admin/masters/rooms", label: "客室" },
      { href: "/admin/api-docs", label: "API / MCP" },
      { href: "/admin/security", label: "セキュリティ" },
      { href: "/admin/audit", label: "操作履歴" },
      { href: "/admin/hq", label: "本部管理", hq: true },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  // 本部ロールは本部管理だけ、施設ロールは本部管理以外を見る
  const groups = NAV.map((g) => ({
    group: g.group,
    items: g.items.filter((i) =>
      role === "hq_admin" ? "hq" in i && i.hq : !("hq" in i && i.hq),
    ).map(({ href, label }) => ({ href, label })),
  })).filter((g) => g.items.length > 0);

  // サイドバーは毎日使う先頭グループだけ全部並べ、残りはグループ単位に1つへまとめる。
  // まとめたページはページ上部のタブで切り替える（SectionTabs）。
  const sidebar = groups.map((g, i) =>
    i === 0 || g.items.length === 1
      ? g
      : {
          group: g.group,
          items: [{ href: g.items[0].href, label: g.group, matches: g.items.map((x) => x.href) }],
        },
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 font-[family-name:var(--font-biz-ud)] md:flex-row">
      <AdminNav groups={sidebar} searchGroups={groups} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 検索は常に一番上。スクロールしても見える位置に固定する（スマホは上部バーの🔍） */}
        <div className="sticky top-0 z-20 hidden border-b border-gray-200 bg-white/95 px-8 py-3 backdrop-blur md:block">
          <SearchTrigger className="flex w-full max-w-2xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition hover:border-cyan-600">
            <span aria-hidden>🔍</span>
            <span className="flex-1">お客様の名前・予約番号・ページ名で検索</span>
            <kbd className="rounded border border-gray-300 px-1.5 text-[11px] text-gray-600">⌘K</kbd>
          </SearchTrigger>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <SectionTabs groups={groups.slice(1)} />
          {children}
        </main>
      </div>

      {/* アシスタントは予約の個人情報を扱うため、本部ロールには出さない */}
      {role === "admin" && <Assistant />}
    </div>
  );
}
