-- 旧チェックインアプリ (smart-checkin-app-v2) の物件情報を受け入れるための列追加。
-- Wi-Fi 情報と備考はゲスト案内に必要で、捨てると復元できないため引き継ぐ。
-- ical_url は将来の外部カレンダー取込（0011 の ical_sources）へ寄せる前提の暫定置き場。

alter table properties add column if not exists wifi_ssid text;
alter table properties add column if not exists wifi_password text;
alter table properties add column if not exists notes text;
alter table properties add column if not exists ical_url text;
