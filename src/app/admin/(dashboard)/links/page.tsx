import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminLink } from "@/types/db";
import { LinkCardManager } from "./LinkCardManager";

export const dynamic = "force-dynamic";

const DEFAULT_LINKS: AdminLink[] = [
  {
    id: "default-1",
    title: "Airbnb ホスト管理",
    url: "https://www.airbnb.jp/hosting",
    category: "OTA・予約サイト",
    description: "予約一覧、ゲストメッセージ対応、カレンダー設定・料金管理",
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-2",
    title: "楽天 Vacation STAY 管理",
    url: "https://vacation-stay.jp/manage/listings",
    category: "OTA・予約サイト",
    description: "楽天Vacation STAYの予約一覧・在庫カレンダー・プラン管理",
    sort_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-3",
    title: "Stripe ダッシュボード",
    url: "https://dashboard.stripe.com/",
    category: "決済・インフラ",
    description: "売上金管理、クレジットカード決済履歴、返金・入金確認",
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-4",
    title: "SwitchBot Web管理",
    url: "https://app.switch-bot.com/",
    category: "スマートロック・IoT",
    description: "玄関ドアのスマートロック施錠状態、パスコード管理、バッテリー確認",
    sort_order: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-5",
    title: "Google ビジネスプロフィール",
    url: "https://business.google.com/",
    category: "集客・SNS",
    description: "Googleマップのクチコミ確認、レビュー返信、施設情報・写真更新",
    sort_order: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-6",
    title: "日靜 公式予約サイト（トップ）",
    url: "https://reserve.gh-nissei.jp",
    category: "公式・自社",
    description: "お客様向けの公式宿泊予約トップページ",
    sort_order: 6,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default async function AdminLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const supabase = createAdminClient();

  const { data, error: fetchError } = await supabase
    .from("admin_links")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  // テーブルがない場合や空の場合は初期プリセットを表示
  let links: AdminLink[] = (data && data.length > 0) ? (data as AdminLink[]) : DEFAULT_LINKS;

  // DBテーブルが空でエラーなく接続できた場合は、初回初期データをDBに投入
  if (!fetchError && data && data.length === 0) {
    await supabase.from("admin_links").insert(
      DEFAULT_LINKS.map(({ id: _id, ...rest }) => rest)
    );
    const { data: refreshed } = await supabase
      .from("admin_links")
      .select("*")
      .order("sort_order", { ascending: true });
    if (refreshed && refreshed.length > 0) {
      links = refreshed as AdminLink[];
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">各種リンク（管理ショートカット）</h1>
        <p className="mt-1 text-sm text-gray-600">
          Airbnb、楽天Vacation STAY、Stripe、SwitchBotなどの外部管理画面やよく使うページへワンタッチでアクセスできます。
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-800">
          {done}
        </div>
      )}

      <LinkCardManager links={links} />
    </div>
  );
}
