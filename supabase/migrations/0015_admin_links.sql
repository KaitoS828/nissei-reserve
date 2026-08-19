-- 0015_admin_links.sql
-- 管理者が外部サービスや重要ページにワンタッチでアクセスできるリンク集テーブル

create table if not exists admin_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  category text not null default '外部サービス', -- 'OTA・予約サイト', '決済・インフラ', 'スマートロック・IoT', '集客・SNS', '公式・自社', 'その他'
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_links_sort on admin_links(sort_order, created_at);

alter table admin_links enable row level security;

do $$ begin
  create policy "admin_links_all" on admin_links
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

-- 初期プリセットリンクの投入
insert into admin_links (title, url, category, description, sort_order)
values
  ('Airbnb ホスト管理', 'https://www.airbnb.jp/hosting', 'OTA・予約サイト', '予約一覧、メッセージ対応、カレンダー・料金管理', 1),
  ('楽天 Vacation STAY 管理', 'https://vacation-stay.jp/manage/listings', 'OTA・予約サイト', '楽天Vacation STAYの予約・在庫・プラン管理', 2),
  ('Stripe ダッシュボード', 'https://dashboard.stripe.com/', '決済・インフラ', '売上金、クレジットカード決済状況、返金処理', 3),
  ('SwitchBot Web管理', 'https://app.switch-bot.com/', 'スマートロック・IoT', 'ドアロック・スマートロックの施錠解錠、状態確認', 4),
  ('Google ビジネスプロフィール', 'https://business.google.com/', '集客・SNS', 'Googleマップのクチコミ確認、返信、店舗情報更新', 5),
  ('日靜 公式予約サイト（トップ）', 'https://reserve.gh-nissei.jp', '公式・自社', 'お客様向けの予約トップページ', 6)
on conflict do nothing;
