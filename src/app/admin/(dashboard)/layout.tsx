import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./_components/AdminNav";
import { Assistant } from "@/app/admin/_components/Assistant";

const NAV = [
  { href: "/admin/hq", label: "本部管理", hq: true },
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
  return <AdminShell>{children}</AdminShell>;
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  const navItems = (role === "hq_admin" ? NAV.filter((item) => item.hq) : NAV).map(
    ({ href, label }) => ({ href, label }),
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-800 md:flex-row">
      <AdminNav items={navItems} />

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>

      {/* アシスタントは予約の個人情報を扱うため、本部ロールには出さない */}
      {role === "admin" && <Assistant />}
    </div>
  );
}
