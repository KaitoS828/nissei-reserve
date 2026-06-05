import Link from "next/link";
import { logout } from "@/app/admin/login/actions";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/calendar", label: "予約カレンダー" },
  { href: "/admin/reservations", label: "予約リスト" },
  { href: "/admin/blocked", label: "予約不可" },
  { href: "/admin/customers", label: "顧客" },
  { href: "/admin/payments", label: "決済" },
  { href: "/admin/analytics", label: "集計・分析" },
  { href: "/admin/masters/room-types", label: "客室タイプ" },
  { href: "/admin/masters/rooms", label: "客室" },
  { href: "/admin/masters/plans", label: "宿泊プラン" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-gray-800 bg-gray-900/40 md:w-56 md:border-b-0 md:border-r">
        {/* ブランド + モバイル用ログアウト */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 md:py-4">
          <Link href="/admin" className="flex items-baseline">
            <span className="text-lg font-semibold text-white">nissei</span>
            <span className="ml-1 text-sm text-cyan-400">予約</span>
          </Link>
          <div className="flex items-center gap-1 md:hidden">
            <Link href="/admin/help" className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-white">
              ❓使い方
            </Link>
            <form action={logout}>
              <button className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-white">
                ログアウト
              </button>
            </form>
          </div>
        </div>

        {/* ナビ: モバイルは横スクロール / PCは縦 */}
        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:gap-0.5 md:overflow-y-auto md:p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* PC用フッター: 使い方FAQ + ログアウト */}
        <div className="hidden border-t border-gray-800 p-3 md:block">
          <Link
            href="/admin/help"
            className="mb-1 block rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            ❓ 使い方・FAQ
          </Link>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-800 hover:text-white">
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
