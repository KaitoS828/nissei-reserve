-- nissei予約システム クラウドSupabase 一括セットアップ
-- Dashboard → SQL Editor に貼り付けて Run してください

-- ===== 0001_init.sql =====
-- nissei予約システム 初期スキーマ (design.md §6)
-- 命名は snake_case。全テーブルに id/created_at/updated_at を持たせる。

create extension if not exists "pgcrypto";

-- updated_at 自動更新トリガー
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 6.1 マスタ
-- ============================================================

create table facility (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  check_in_time time default '15:00',
  check_out_time time default '10:00',
  cancel_policy jsonb,                 -- {days_before: rate} 例 {"7":0,"3":0.5,"0":1.0}
  settings jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity int not null default 2,
  base_price int not null,
  amenities jsonb default '[]',
  images jsonb default '[]',
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id) on delete restrict,
  name text not null,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  meal_type text,                      -- none/breakfast/dinner/both
  sale_period daterange,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  room_type_id uuid references room_types(id) on delete cascade,
  price_per_night int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, room_type_id)
);

create table options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null,
  unit text default 'per_stay',        -- per_stay/per_night/per_person
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6.2 顧客
-- ============================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  last_name text,
  first_name text,
  email text,
  phone text,
  is_member boolean default false,
  is_blacklisted boolean default false,
  blacklist_reason text,
  visit_count int default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_tags (
  customer_id uuid references customers(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (customer_id, tag_id)
);

-- ============================================================
-- 6.3 予約・在庫・決済
-- ============================================================

create type reservation_status as enum
  ('pending','confirmed','checked_in','checked_out','cancelled','no_show');
create type payment_status as enum
  ('unpaid','authorized','paid','refunded','partially_refunded','failed');

create table reservations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid references customers(id),
  plan_id uuid references plans(id),
  room_type_id uuid references room_types(id),
  room_id uuid references rooms(id),
  check_in date not null,
  check_out date not null,
  nights int generated always as (check_out - check_in) stored,
  num_guests int not null default 1,
  amount int not null,
  status reservation_status default 'pending',
  payment_status payment_status default 'unpaid',
  source text default 'web',           -- web/admin/line
  gcal_event_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservation_options (
  reservation_id uuid references reservations(id) on delete cascade,
  option_id uuid references options(id),
  qty int default 1,
  primary key (reservation_id, option_id)
);

create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id),   -- null=全タイプ休業
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount int not null,
  fee int,
  refunded_amount int default 0,
  status payment_status not null,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6.4 通知・問合せ・アンケート
-- ============================================================

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,               -- booking_confirmed/reminder/thanks/cancelled
  channel text not null,               -- email/line
  subject text,
  body text,
  send_offset_hours int,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text,
  email text,
  title text,
  body text,
  status text default 'open',          -- open/answered/closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table surveys (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  nps_score int,
  answers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- updated_at トリガー登録
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'facility','room_types','rooms','plans','plan_prices','options',
    'customers','tags','reservations','blocked_dates','payments',
    'notification_templates','inquiries','surveys'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- インデックス（空室判定・検索の頻出経路）
-- ============================================================

create index idx_reservations_dates on reservations (check_in, check_out);
create index idx_reservations_room_type on reservations (room_type_id);
create index idx_reservations_status on reservations (status);
create index idx_blocked_dates_range on blocked_dates (start_date, end_date);
create index idx_rooms_type on rooms (room_type_id);
create index idx_customers_email on customers (email);

-- ===== 0002_rls.sql =====
-- RLS 方針 (design.md §6.5)
-- - 管理者(app_metadata.role='admin')のみ管理系テーブルを全操作可
-- - ゲスト書き込みは service role(サーバ)経由のみ → public な write ポリシーは作らない
-- - 公開クライアントは空室・プランの read のみ
-- - 会員は自分(auth_user_id = auth.uid())の予約のみ参照可

create or replace function is_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- 全テーブルで RLS を有効化
do $$
declare t text;
begin
  foreach t in array array[
    'facility','room_types','rooms','plans','plan_prices','options',
    'customers','tags','customer_tags','reservations','reservation_options',
    'blocked_dates','payments','notification_templates','inquiries','surveys'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- 管理者は全操作可
    execute format(
      'create policy %1$s_admin_all on %1$s
       for all to authenticated
       using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 公開 read（active のみ）: anon / authenticated 両方
-- ------------------------------------------------------------
create policy room_types_public_read on room_types
  for select to anon, authenticated using (is_active);

create policy rooms_public_read on rooms
  for select to anon, authenticated using (is_active);

create policy plans_public_read on plans
  for select to anon, authenticated using (is_active);

create policy plan_prices_public_read on plan_prices
  for select to anon, authenticated using (true);

create policy options_public_read on options
  for select to anon, authenticated using (is_active);

create policy facility_public_read on facility
  for select to anon, authenticated using (true);

create policy blocked_dates_public_read on blocked_dates
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 会員: 自分のレコードのみ
-- ------------------------------------------------------------
create policy customers_self_read on customers
  for select to authenticated using (auth_user_id = auth.uid());

create policy reservations_self_read on reservations
  for select to authenticated
  using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

-- ===== seed.sql =====
-- 初期シード（ローカル開発用）
-- 実データ（実際の部屋数・料金・プラン名）が未確定のためサンプル値。
-- 管理画面から編集する前提。キャンセルポリシーは design.md §13 の例を採用。

insert into facility (name, address, phone, check_in_time, check_out_time, cancel_policy)
values (
  'nissei サウナ宿',
  '北海道広尾郡広尾町',
  '',
  '15:00',
  '10:00',
  '{"7":0,"3":0.5,"0":1.0}'::jsonb   -- 7日前まで無料 / 3日前50% / 当日100%
);

-- サンプル客室タイプ
with rt as (
  insert into room_types (name, description, capacity, base_price, sort_order)
  values
    ('スタンダード', 'サウナ付きスタンダードルーム', 2, 18000, 1),
    ('デラックス',   '貸切サウナ付きデラックスルーム', 4, 32000, 2)
  returning id, name
)
-- サンプル客室
insert into rooms (room_type_id, name)
select rt.id, r.name
from rt
join (values
  ('スタンダード', '101'),
  ('スタンダード', '102'),
  ('デラックス',   '201')
) as r(type_name, name) on r.type_name = rt.name;

-- サンプル宿泊プラン
insert into plans (name, description, meal_type, sort_order)
values
  ('素泊まり', '食事なし・サウナ利用込み', 'none', 1),
  ('朝食付き', '地元食材の朝食付き', 'breakfast', 2);
