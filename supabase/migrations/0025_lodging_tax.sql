-- 0025_lodging_tax.sql
-- 北海道宿泊税の申告に使う特別徴収義務者の情報（1行のみ）と、申告・納入の記録。

create table if not exists lodging_tax_settings (
  id int primary key default 1 check (id = 1),
  designation_no text,         -- 指定番号（徴収原簿番号・12桁）
  operator_address text,       -- 特別徴収義務者の住所（所在地）
  operator_name text,          -- 氏名（名称）・代表者の氏名
  corporate_no text,           -- 個人番号又は法人番号
  facility_address text,       -- 宿泊施設の所在地
  facility_name text,          -- 宿泊施設名（営業許可の名称）
  updated_at timestamptz not null default now()
);

create table if not exists lodging_tax_filings (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,  -- 対象期間の初日（例 2026-09-01）
  filed_on date,               -- 申告書を提出した日
  paid_on date,                -- 納入した日
  amount integer,              -- 納入した税額（円）
  method text,                 -- eltax / mail / visit
  note text,
  created_at timestamptz not null default now(),
  unique (period_start)
);

alter table lodging_tax_settings enable row level security;
alter table lodging_tax_filings enable row level security;

do $$ begin
  create policy "lodging_tax_settings_all" on lodging_tax_settings
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "lodging_tax_filings_all" on lodging_tax_filings
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;
