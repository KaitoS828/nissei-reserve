-- 0024_admin_links_repair.sql
-- 0015 は適用済みの記録があるのに本番に admin_links テーブルが存在しなかったため、同じ定義を作り直す（既にあれば何もしない）。
-- 初期リンクは「各種リンク」画面を開いたときにアプリ側が投入する。
create table if not exists admin_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  category text not null default '外部サービス',
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
