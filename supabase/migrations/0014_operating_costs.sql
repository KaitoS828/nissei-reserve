-- 0014_operating_costs.sql
-- 集計・分析画面でのコスト（経費）管理用テーブル

create table if not exists operating_costs (
  id uuid primary key default gen_random_uuid(),
  year_month text not null, -- 'YYYY-MM' 形式 (例: '2026-08')
  category text not null default 'その他',
  amount int not null default 0 check (amount >= 0),
  description text,
  recorded_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operating_costs_year_month on operating_costs(year_month);

alter table operating_costs enable row level security;

do $$ begin
  create policy "admin_operating_costs_all" on operating_costs
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;
