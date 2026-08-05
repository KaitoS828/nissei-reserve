-- SaaS化の土台。
-- 既存の1施設運用を壊さず、施設単位の分離・公開slug・本部集計を追加する。

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('trial','active','paused','cancelled')),
  plan text not null default 'starter',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner','manager','staff','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table facility add column if not exists organization_id uuid references organizations(id) on delete restrict;
alter table facility add column if not exists slug text;
alter table facility add column if not exists status text not null default 'active'
  check (status in ('draft','active','paused','archived'));
alter table facility add column if not exists public_site_enabled boolean not null default true;
alter table facility add column if not exists stripe_connect_account_id text;
alter table facility add column if not exists admin_note text;

insert into organizations (name, slug, status, plan)
select '日靜 運営', 'nissei', 'active', 'starter'
where not exists (select 1 from organizations where slug = 'nissei');

with ranked_facility as (
  select
    id,
    row_number() over (order by created_at, id) as rn
  from facility
)
update facility f
set
  organization_id = coalesce(f.organization_id, (select id from organizations where slug = 'nissei')),
  slug = coalesce(f.slug, case when rf.rn = 1 then 'nissei' else 'nissei-' || left(f.id::text, 8) end),
  status = case when rf.rn = 1 then f.status else 'archived' end,
  public_site_enabled = case when rf.rn = 1 then f.public_site_enabled else false end
from ranked_facility rf
where f.id = rf.id
  and (f.slug is null or f.organization_id is null);

with duplicate_slugs as (
  select
    id,
    row_number() over (partition by slug order by created_at, id) as rn
  from facility
  where slug is not null
)
update facility f
set
  slug = f.slug || '-' || left(f.id::text, 8),
  status = 'archived',
  public_site_enabled = false
from duplicate_slugs d
where f.id = d.id
  and d.rn > 1;

create unique index if not exists idx_facility_slug_unique on facility (slug) where slug is not null;
create index if not exists idx_facility_organization on facility (organization_id);

alter table room_types add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table plans add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table options add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table customers add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table reservations add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table blocked_dates add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table notification_templates add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table inquiries add column if not exists facility_id uuid references facility(id) on delete restrict;
alter table plan_prices add column if not exists pricing_rule jsonb not null default '{}';

with primary_facility as (
  select id from facility order by created_at limit 1
)
update room_types set facility_id = (select id from primary_facility) where facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update plans set facility_id = (select id from primary_facility) where facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update options set facility_id = (select id from primary_facility) where facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update customers set facility_id = (select id from primary_facility) where facility_id is null;

update reservations r
set facility_id = coalesce(
  (select rt.facility_id from room_types rt where rt.id = r.room_type_id),
  (select p.facility_id from plans p where p.id = r.plan_id),
  (select id from facility order by created_at limit 1)
)
where r.facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update blocked_dates set facility_id = (select id from primary_facility) where facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update notification_templates set facility_id = (select id from primary_facility) where facility_id is null;

with primary_facility as (
  select id from facility order by created_at limit 1
)
update inquiries set facility_id = (select id from primary_facility) where facility_id is null;

create index if not exists idx_room_types_facility on room_types (facility_id);
create index if not exists idx_plans_facility on plans (facility_id);
create index if not exists idx_customers_facility on customers (facility_id);
create index if not exists idx_reservations_facility_dates on reservations (facility_id, check_in, check_out);
create index if not exists idx_blocked_dates_facility on blocked_dates (facility_id, start_date, end_date);

update plan_prices pp
set pricing_rule = jsonb_build_object(
  'type', 'per_person',
  'amount_per_person', 7000,
  'min_guests', 1,
  'max_guests', 6
)
from plans p
where pp.plan_id = p.id
  and p.name = '素泊まりプラン'
  and pp.pricing_rule = '{}';

update plan_prices pp
set pricing_rule = jsonb_build_object(
  'type', 'per_person',
  'amount_per_person', 10000,
  'min_guests', 2,
  'max_guests', 6,
  'minimum_charge', 20000
)
from plans p
where pp.plan_id = p.id
  and p.name like '%KOBU%'
  and p.name not like '%日帰り%'
  and pp.pricing_rule = '{}';

create or replace view hq_facility_metrics as
select
  f.id as facility_id,
  f.name as facility_name,
  f.slug as facility_slug,
  f.status as facility_status,
  f.public_site_enabled,
  count(r.id) as reservations_total,
  count(r.id) filter (where r.status in ('pending','confirmed','checked_in')) as reservations_active,
  count(r.id) filter (where r.status = 'cancelled') as reservations_cancelled,
  coalesce(sum(r.amount) filter (where r.payment_status = 'paid'), 0) as paid_revenue,
  coalesce(sum(r.nights) filter (where r.status not in ('cancelled','no_show')), 0) as occupied_nights,
  max(r.created_at) as last_reservation_at
from facility f
left join reservations r on r.facility_id = f.id
group by f.id, f.name, f.slug, f.status, f.public_site_enabled;

alter table organizations enable row level security;
alter table organization_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_admin_all'
  ) then
    create policy organizations_admin_all on organizations
      for all to authenticated
      using (is_admin()) with check (is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
      and policyname = 'organization_members_admin_all'
  ) then
    create policy organization_members_admin_all on organization_members
      for all to authenticated
      using (is_admin()) with check (is_admin());
  end if;
end $$;
