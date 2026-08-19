-- ============================================================
-- 緊急セキュリティパッチ: reservations RLS 漏洩修正
-- 実行日: 2026-08-13
-- 問題: 一般ログインユーザーが全ての予約を参照できてしまっていた
-- 原因: RLS ポリシーが未適用 or 競合ポリシーにより全件取得されていた
-- ============================================================
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください。
-- 冪等（何度実行しても安全）に設計してあります。
-- ============================================================

-- ============================================================
-- Step 1: reservations テーブルの RLS 有効化を確実に
-- ============================================================
alter table public.reservations enable row level security;
alter table public.reservations force row level security;

-- ============================================================
-- Step 2: customers テーブルの RLS 有効化を確実に
-- ============================================================
alter table public.customers enable row level security;
alter table public.customers force row level security;

-- ============================================================
-- Step 3: 既存の reservations ポリシーを全削除してクリーンな状態にする
-- ============================================================
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'reservations'
  loop
    execute format('drop policy if exists %I on public.reservations', pol.policyname);
    raise notice 'Dropped policy: %', pol.policyname;
  end loop;
end $$;

-- ============================================================
-- Step 4: 既存の customers ポリシーを全削除してクリーンな状態にする
-- ============================================================
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'customers'
  loop
    execute format('drop policy if exists %I on public.customers', pol.policyname);
    raise notice 'Dropped policy: %', pol.policyname;
  end loop;
end $$;

-- ============================================================
-- Step 5: is_admin() 関数が存在することを確認（念のため再作成）
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ============================================================
-- Step 6: reservations ポリシーを正しく再設定
-- ============================================================

-- 管理者: 全操作可
create policy reservations_admin_all on public.reservations
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 一般会員: 自分の customer_id に紐づく予約のみ SELECT 可
create policy reservations_member_self_read on public.reservations
  for select
  to authenticated
  using (
    public.is_admin() = false
    and customer_id in (
      select id
      from public.customers
      where auth_user_id = auth.uid()
    )
  );

-- anon（非ログイン）は一切参照不可
-- ※ポリシーを追加しない = anon は RLS によりデフォルト拒否

-- ============================================================
-- Step 7: customers ポリシーを正しく再設定
-- ============================================================

-- 管理者: 全操作可
create policy customers_admin_all on public.customers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 一般会員: 自分のレコードのみ SELECT 可
create policy customers_member_self_read on public.customers
  for select
  to authenticated
  using (
    public.is_admin() = false
    and auth_user_id = auth.uid()
  );

-- ============================================================
-- Step 8: 適用確認クエリ（Run 後にここで結果を確認）
-- ============================================================
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('reservations', 'customers')
order by tablename, policyname;
