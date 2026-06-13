-- 予約のアーカイブ（ハード削除の代わりに非表示化）
-- Supabase SQL Editor に貼り付けて実行する
alter table reservations add column if not exists archived_at timestamptz;
create index if not exists idx_reservations_archived_at on reservations(archived_at);
