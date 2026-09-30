-- 0022_ota_fee_rates.sql
-- OTA（予約経路）ごとの販売手数料率。売上（予約金額）に掛けて、経費として自動計上する。

create table if not exists ota_fee_rates (
  source text primary key,                                   -- reservations.source と同じ値 (airbnb / booking / rakuten / vacation_stay ...)
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100), -- 単位は%
  updated_at timestamptz not null default now()
);

alter table ota_fee_rates enable row level security;

do $$ begin
  create policy "ota_fee_rates_all" on ota_fee_rates
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

-- Rakuten Oyado (Vacation STAY) は一律3%（ゲスト負担の手配手数料は売上に含まれないため対象外）
insert into ota_fee_rates (source, rate) values ('vacation_stay', 3)
on conflict (source) do nothing;
