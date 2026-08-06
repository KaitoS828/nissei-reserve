-- integrated リポジトリ (nissei-reserve-integrated) の 0007〜0016 を統合したもの。
-- 両リポジトリは 0007 以降で migration 履歴が分岐しているため、番号をそのまま
-- 適用できない。ここでは integrated 側にしか無いオブジェクトだけを取り込み、
-- 再実行しても壊れないよう create type / create policy をガードしてある。


-- ===== 0007_integrated_checkin.sql =====
-- Integrated reserve + smart check-in schema.
-- New Supabase projects should apply the base migrations first, then this file.

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  check_in_time time default '15:00',
  check_out_time time default '10:00',
  switchbot_keypad_device_id text,
  google_calendar_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table room_types add column if not exists property_id uuid references properties(id) on delete set null;
alter table rooms add column if not exists property_id uuid references properties(id) on delete set null;
alter table reservations add column if not exists property_id uuid references properties(id) on delete set null;

create table if not exists reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  guest_order int not null default 1,
  full_name text not null,
  address text,
  contact text,
  occupation text,
  gender text,
  is_foreign_national boolean not null default false,
  nationality text,
  passport_number text,
  passport_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reservation_id, guest_order)
);

do $$ begin
  create type checkin_status as enum
  ('pending','pre_registered','identity_verified','checked_in');
exception when duplicate_object then null;
end $$;

create table if not exists reservation_checkins (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  secret_code text not null unique,
  status checkin_status not null default 'pending',
  pre_registered_at timestamptz,
  identity_verified_at timestamptz,
  checked_in_at timestamptz,
  whereby_room_url text,
  whereby_host_room_url text,
  cleaning_confirmed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type access_key_status as enum
  ('pending','issued','revoked','expired');
exception when duplicate_object then null;
end $$;

create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  door_pin text,
  provider text not null default 'manual',
  switchbot_key_id int,
  status access_key_status not null default 'pending',
  valid_from timestamptz,
  valid_until timestamptz,
  issued_at timestamptz,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_active on properties(is_active);
create index if not exists idx_reservation_guests_reservation on reservation_guests(reservation_id);
create index if not exists idx_reservation_guests_name on reservation_guests(full_name);
create index if not exists idx_reservation_checkins_secret_code on reservation_checkins(secret_code);
create index if not exists idx_reservation_checkins_status on reservation_checkins(status);
create index if not exists idx_access_keys_status on access_keys(status);
create index if not exists idx_access_keys_room on access_keys(room_id);

do $$
declare t text;
begin
  foreach t in array array['properties','reservation_guests','reservation_checkins','access_keys'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;


-- ===== 0008_guest_demographics.sql =====
-- 宿泊者名簿の属性分析（年代・男女比）のためのカラム追加。
-- gender は既存の自由入力を活かしつつ、以後は 'male'/'female'/'other' で保存する。

alter table reservation_guests add column if not exists birth_date date;

create index if not exists idx_reservation_guests_gender on reservation_guests(gender);
create index if not exists idx_reservation_guests_birth_date on reservation_guests(birth_date);

-- 宿のSNS・HPなどのリンク管理（公開ページやゲスト案内から参照するハブ）
create table if not exists site_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  category text not null default 'other',
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_links_active on site_links(is_active, sort_order);

drop trigger if exists trg_site_links_updated_at on site_links;
create trigger trg_site_links_updated_at before update on site_links
  for each row execute function set_updated_at();

alter table site_links enable row level security;

-- 公開側でも「宿のリンク集」として読めるようにする（書き込みは service_role のみ）
drop policy if exists site_links_public_read on site_links;
drop policy if exists site_links_public_read on site_links;
create policy site_links_public_read on site_links
  for select using (is_active = true);


-- ===== 0009_reservation_operations.sql =====
alter type reservation_status add value if not exists 'needs_attention';
alter type reservation_status add value if not exists 'cancel_requested';


-- ===== 0010_admin_operations.sql =====
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('additional_charge','refund_due','refund_done','waived')),
  amount int not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','sent','paid','refunded','waived')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operation_reminders (
  id uuid primary key default gen_random_uuid(),
  reminder_type text not null,
  target_date date not null,
  channel text not null default 'owner',
  sent_to text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

create table if not exists post_stay_followups (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','skipped')),
  channel text not null default 'email',
  sent_to text,
  note text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_payment_adjustments_reservation on payment_adjustments(reservation_id);
create index if not exists idx_operation_reminders_target on operation_reminders(target_date, reminder_type);
create index if not exists idx_post_stay_followups_status on post_stay_followups(status);

do $$
declare t text;
begin
  foreach t in array array['audit_logs','payment_adjustments','operation_reminders','post_stay_followups'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'drop policy if exists %1$s_admin_all on %1$s;
       create policy %1$s_admin_all on %1$s
       for all to authenticated
       using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;


-- ===== 0011_product_value_features.sql =====
create table if not exists seasonal_rates (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id) on delete cascade,
  plan_id uuid references plans(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  price_per_night integer not null check (price_per_night >= 0),
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create table if not exists booking_rules (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  min_nights integer not null default 1 check (min_nights >= 1),
  max_nights integer check (max_nights is null or max_nights >= min_nights),
  advance_cutoff_days integer not null default 0 check (advance_cutoff_days >= 0),
  gap_days integer not null default 0 check (gap_days >= 0),
  closed_weekdays integer[] not null default '{}',
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date)
);

create table if not exists cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'cleaning',
  sort_order integer not null default 0,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reservation_cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  cleaning_task_id uuid not null references cleaning_tasks(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, cleaning_task_id)
);

create table if not exists guest_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null,
  subject text not null,
  body text not null,
  timing text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ical_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_type text not null default 'external',
  room_type_id uuid references room_types(id) on delete set null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seasonal_rates_range on seasonal_rates (start_date, end_date);
create index if not exists idx_seasonal_rates_room_plan on seasonal_rates (room_type_id, plan_id);
create index if not exists idx_booking_rules_range on booking_rules (start_date, end_date);
create index if not exists idx_reservation_cleaning_tasks_reservation on reservation_cleaning_tasks (reservation_id);
create index if not exists idx_guest_messages_type on guest_messages (message_type);

alter table seasonal_rates enable row level security;
alter table booking_rules enable row level security;
alter table cleaning_tasks enable row level security;
alter table reservation_cleaning_tasks enable row level security;
alter table guest_messages enable row level security;
alter table ical_sources enable row level security;

drop policy if exists seasonal_rates_admin_all on seasonal_rates;
create policy seasonal_rates_admin_all on seasonal_rates for all using (is_admin()) with check (is_admin());
drop policy if exists booking_rules_admin_all on booking_rules;
create policy booking_rules_admin_all on booking_rules for all using (is_admin()) with check (is_admin());
drop policy if exists cleaning_tasks_admin_all on cleaning_tasks;
create policy cleaning_tasks_admin_all on cleaning_tasks for all using (is_admin()) with check (is_admin());
drop policy if exists reservation_cleaning_tasks_admin_all on reservation_cleaning_tasks;
create policy reservation_cleaning_tasks_admin_all on reservation_cleaning_tasks for all using (is_admin()) with check (is_admin());
drop policy if exists guest_messages_admin_all on guest_messages;
create policy guest_messages_admin_all on guest_messages for all using (is_admin()) with check (is_admin());
drop policy if exists ical_sources_admin_all on ical_sources;
create policy ical_sources_admin_all on ical_sources for all using (is_admin()) with check (is_admin());

drop policy if exists seasonal_rates_public_read on seasonal_rates;
create policy seasonal_rates_public_read on seasonal_rates
  for select using (is_active = true);

drop policy if exists booking_rules_public_read on booking_rules;
create policy booking_rules_public_read on booking_rules
  for select using (is_active = true);

drop policy if exists guest_messages_public_read on guest_messages;
create policy guest_messages_public_read on guest_messages
  for select using (is_active = true);

insert into cleaning_tasks (title, category, sort_order, is_required)
values
  ('寝具・リネンを交換する', 'cleaning', 10, true),
  ('水回り・浴室・トイレを清掃する', 'cleaning', 20, true),
  ('サウナ室・水風呂・外気浴スペースを確認する', 'sauna', 30, true),
  ('忘れ物を確認する', 'handoff', 40, true),
  ('備品・消耗品を補充する', 'stock', 50, true),
  ('鍵/PIN・チェックイン案内を確認する', 'handoff', 60, true)
on conflict do nothing;

insert into guest_messages (message_type, subject, body, timing)
values
  ('booking_confirmed', '【日靜】ご予約ありがとうございます', 'ご予約ありがとうございます。予約内容をご確認のうえ、ご到着前に宿泊者情報の登録をお願いいたします。', 'on_confirmed'),
  ('pre_arrival', '【日靜】ご宿泊前日のご案内', '明日のご到着をお待ちしております。チェックイン方法、鍵、駐車場、Wi-Fi、周辺情報はゲストガイドをご確認ください。', 'one_day_before'),
  ('post_stay', '【日靜】ご宿泊ありがとうございました', 'この度は日靜にご宿泊いただきありがとうございました。またのお越しを心よりお待ちしております。', 'after_checkout')
on conflict do nothing;


-- ===== 0012_guest_ops_integrations.sql =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_images_public_read on storage;
create policy site_images_public_read on storage.objects
  for select using (bucket_id = 'site-images');

drop policy if exists site_images_admin_insert on storage;
create policy site_images_admin_insert on storage.objects
  for insert with check (bucket_id = 'site-images' and is_admin());

drop policy if exists site_images_admin_update on storage;
create policy site_images_admin_update on storage.objects
  for update using (bucket_id = 'site-images' and is_admin()) with check (bucket_id = 'site-images' and is_admin());

drop policy if exists site_images_admin_delete on storage;
create policy site_images_admin_delete on storage.objects
  for delete using (bucket_id = 'site-images' and is_admin());

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'site-images',
  path text not null,
  public_url text not null,
  label text,
  alt_text text,
  usage text not null default 'gallery',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);

create table if not exists guest_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete cascade,
  guest_message_id uuid references guest_messages(id) on delete set null,
  message_type text not null,
  channel text not null default 'email',
  sent_to text,
  subject text,
  status text not null default 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists receipt_issues (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  receipt_no text not null unique,
  recipient_name text not null,
  proviso text not null default 'ご宿泊代として',
  amount integer not null check (amount >= 0),
  issued_by text,
  invoice_registration_number text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists review_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  channel text not null default 'google',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ical_import_logs (
  id uuid primary key default gen_random_uuid(),
  ical_source_id uuid references ical_sources(id) on delete cascade,
  status text not null,
  imported_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_assets_usage on media_assets (usage, created_at);
create index if not exists idx_guest_message_deliveries_reservation on guest_message_deliveries (reservation_id);
create index if not exists idx_guest_message_deliveries_type on guest_message_deliveries (message_type, status);
create index if not exists idx_receipt_issues_reservation on receipt_issues (reservation_id);
create index if not exists idx_review_links_active on review_links (is_active, sort_order);
create index if not exists idx_ical_import_logs_source on ical_import_logs (ical_source_id, created_at);

alter table media_assets enable row level security;
alter table guest_message_deliveries enable row level security;
alter table receipt_issues enable row level security;
alter table review_links enable row level security;
alter table ical_import_logs enable row level security;

drop policy if exists media_assets_admin_all on media_assets;
create policy media_assets_admin_all on media_assets for all using (is_admin()) with check (is_admin());
drop policy if exists media_assets_public_read on media_assets;
create policy media_assets_public_read on media_assets for select using (true);

drop policy if exists guest_message_deliveries_admin_all on guest_message_deliveries;
create policy guest_message_deliveries_admin_all on guest_message_deliveries for all using (is_admin()) with check (is_admin());
drop policy if exists receipt_issues_admin_all on receipt_issues;
create policy receipt_issues_admin_all on receipt_issues for all using (is_admin()) with check (is_admin());
drop policy if exists review_links_admin_all on review_links;
create policy review_links_admin_all on review_links for all using (is_admin()) with check (is_admin());
drop policy if exists review_links_public_read on review_links;
create policy review_links_public_read on review_links for select using (is_active = true);
drop policy if exists ical_import_logs_admin_all on ical_import_logs;
create policy ical_import_logs_admin_all on ical_import_logs for all using (is_admin()) with check (is_admin());

alter table facility add column if not exists invoice_registration_number text;
alter table facility add column if not exists receipt_issuer_name text;

insert into review_links (label, url, channel, sort_order)
values
  ('Googleマップ', 'https://www.google.com/search?q=%E3%82%B2%E3%82%B9%E3%83%88%E3%83%8F%E3%82%A6%E3%82%B9%E6%97%A5%E9%9D%9C', 'google', 10)
on conflict do nothing;

insert into guest_messages (message_type, subject, body, timing)
values
  ('checkin_reminder', '【日靜】ご宿泊者情報の事前登録をお願いします', '{{name}} 様\nご宿泊前に、下記URLから宿泊者情報の事前登録をお願いいたします。\n{{register_url}}\n予約番号: {{code}}', 'one_day_before'),
  ('pre_arrival', '【日靜】明日のご宿泊案内（{{code}}）', '{{name}} 様\n明日のご到着をお待ちしております。\nチェックイン: {{check_in}}\nチェックアウト: {{check_out}}\n事前登録URL: {{register_url}}', 'one_day_before'),
  ('post_stay', '【日靜】ご宿泊ありがとうございました', '{{name}} 様\nこの度は日靜にご宿泊いただきありがとうございました。\nよろしければ、下記よりご感想をお寄せください。\n{{review_links}}', 'after_checkout')
on conflict do nothing;


-- ===== 0013_plan_draft_publish.sql =====
alter table plans alter column is_active set default false;

update plans
set is_active = false, updated_at = now()
where
  is_active = true
  and (
    nullif(trim(name), '') is null
    or nullif(trim(coalesce(description, '')), '') is null
    or not exists (
      select 1
      from plan_prices
      where plan_prices.plan_id = plans.id
        and plan_prices.price_per_night > 0
    )
  );


-- ===== 0014_integration_settings_and_link_cycles.sql =====
-- 管理画面から外部連携キーとリンク更新サイクルを扱う。

create table if not exists integration_settings (
  key text primary key,
  label text not null,
  category text not null default 'other',
  value text,
  is_secret boolean not null default true,
  description text,
  placeholder text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_settings_category_sort
  on integration_settings(category, sort_order);

drop trigger if exists trg_integration_settings_updated_at on integration_settings;
create trigger trg_integration_settings_updated_at before update on integration_settings
  for each row execute function set_updated_at();

alter table integration_settings enable row level security;

drop policy if exists integration_settings_admin_all on integration_settings;
drop policy if exists integration_settings_admin_all on integration_settings;
create policy integration_settings_admin_all on integration_settings
  for all using (is_admin()) with check (is_admin());

insert into integration_settings (key, label, category, is_secret, description, placeholder, sort_order)
values
  ('resend_api_key', 'Resend APIキー', 'mail', true, '予約確認・キャンセル・宿泊前後のメール送信に使用します。', 're_...', 10),
  ('email_from', '送信元メールアドレス', 'mail', false, 'お客様へ送るメールの From に使います。', 'info@example.com', 20),
  ('owner_emails', '管理者通知メール', 'mail', false, 'カンマ区切りで複数指定できます。', 'owner@example.com,staff@example.com', 30),
  ('gas_webapp_url', 'Google Apps Script WebアプリURL', 'calendar', false, 'Googleカレンダー同期用のGASエンドポイントです。', 'https://script.google.com/macros/s/.../exec', 40),
  ('gas_shared_secret', 'Google Apps Script共有シークレット', 'calendar', true, 'GAS側とこのアプリ側で一致させる秘密文字列です。', '任意の長い文字列', 50),
  ('slack_webhook_url', 'Slack Incoming Webhook URL', 'notification', true, '新規予約・キャンセルなどの運用通知に使用します。', 'https://hooks.slack.com/services/...', 60),
  ('discord_webhook_url', 'Discord Webhook URL', 'notification', true, 'Slack未設定時の運用通知に使用します。', 'https://discord.com/api/webhooks/...', 70),
  ('slack_signing_secret', 'Slack Signing Secret', 'notification', true, 'Slack Event Subscriptions の署名検証に使用します。', 'Slack AppのBasic Informationから取得', 80),
  ('slack_bot_token', 'Slack Bot Token', 'notification', true, 'Slack上のAIエージェント返信に使用します。', 'xoxb-...', 90),
  ('switchbot_token', 'SwitchBot Token', 'smart_lock', true, 'スマートロック連携でPINを発行するためのトークンです。', 'SwitchBotアプリ/APIから取得', 100),
  ('switchbot_secret', 'SwitchBot Secret', 'smart_lock', true, 'SwitchBot API署名等に使うシークレットです。', 'SwitchBotアプリ/APIから取得', 110),
  ('switchbot_keypad_device_id', 'SwitchBot Keypad Device ID', 'smart_lock', false, 'PINを登録するキーパッド/ロックのデバイスIDです。', 'XXXXXXXXXXXX', 120),
  ('switchbot_pin_proxy_url', 'SwitchBot PINプロキシURL', 'smart_lock', false, '端末構成差を吸収してPIN発行する自前APIのURLです。', 'https://example.com/api/switchbot-pin', 130),
  ('cron_secret', 'Cron共有シークレット', 'automation', true, '自動メッセージやiCal取り込みAPIを外部cronから叩く時の認証に使います。', '任意の長い文字列', 140)
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  is_secret = excluded.is_secret,
  description = excluded.description,
  placeholder = excluded.placeholder,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table site_links add column if not exists update_interval_days int;
alter table site_links add column if not exists last_updated_at timestamptz;
alter table site_links add column if not exists next_update_at timestamptz;

alter table site_links
  drop constraint if exists site_links_update_interval_days_check;
alter table site_links
  add constraint site_links_update_interval_days_check
  check (update_interval_days is null or update_interval_days > 0);

create index if not exists idx_site_links_next_update
  on site_links(next_update_at) where next_update_at is not null;


-- ===== 0015_site_image_upload_limit.sql =====
-- Supabase無料プラン運用を想定し、画像1枚あたりのアップロード上限を5MBに抑える。

update storage.buckets
set file_size_limit = 5242880
where id = 'site-images';


-- ===== 0016_operational_tasks.sql =====
-- 宿・民泊運営HUBとして、清掃外の運用タスクも管理する。

create table if not exists operational_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'other',
  description text,
  due_date date,
  recurrence_days int,
  priority text not null default 'normal',
  status text not null default 'open',
  related_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_tasks_priority_check check (priority in ('low', 'normal', 'high')),
  constraint operational_tasks_status_check check (status in ('open', 'done', 'skipped')),
  constraint operational_tasks_recurrence_days_check check (recurrence_days is null or recurrence_days > 0)
);

create index if not exists idx_operational_tasks_status_due
  on operational_tasks(status, due_date);
create index if not exists idx_operational_tasks_category
  on operational_tasks(category);

drop trigger if exists trg_operational_tasks_updated_at on operational_tasks;
create trigger trg_operational_tasks_updated_at before update on operational_tasks
  for each row execute function set_updated_at();

alter table operational_tasks enable row level security;

drop policy if exists operational_tasks_admin_all on operational_tasks;
drop policy if exists operational_tasks_admin_all on operational_tasks;
create policy operational_tasks_admin_all on operational_tasks
  for all using (is_admin()) with check (is_admin());
