-- 内部AIチャット（Slackスレッド / 管理画面）の会話ログ。
-- サーバーレスのコールドスタートや画面リロードをまたいでも、キャッチボールの文脈を引き継ぐ。
create table if not exists assistant_sessions (
  session_key text primary key,
  channel text not null,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index if not exists idx_assistant_sessions_updated on assistant_sessions (updated_at desc);
alter table assistant_sessions enable row level security;
