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
