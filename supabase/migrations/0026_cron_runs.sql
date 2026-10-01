-- 0026_cron_runs.sql
-- 自動実行（cron）の実行結果。止まっていることに気づけるよう、管理画面で一覧する。

create table if not exists cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ok boolean not null,
  duration_ms integer,
  summary jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cron_runs_job on cron_runs (job, created_at desc);

alter table cron_runs enable row level security;

drop policy if exists cron_runs_admin_all on cron_runs;
create policy cron_runs_admin_all on cron_runs for all using (is_admin()) with check (is_admin());
