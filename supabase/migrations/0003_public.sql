-- Phase 2: 公開予約フロー向けスキーマ拡張

-- 顧客: カナ・住所
alter table customers add column if not exists last_name_kana text;
alter table customers add column if not exists first_name_kana text;
alter table customers add column if not exists prefecture text;
alter table customers add column if not exists city text;
alter table customers add column if not exists address text;
alter table customers add column if not exists building text;

-- 予約: チェックイン予定時刻・子供人数・アンケート・照会トークン
alter table reservations add column if not exists check_in_time time;
alter table reservations add column if not exists num_children int default 0;
alter table reservations add column if not exists survey text;
alter table reservations add column if not exists lookup_token text;

-- プラン: 長文説明・タグ・長期割引・画像
alter table plans add column if not exists long_description text;
alter table plans add column if not exists tags jsonb default '[]';
alter table plans add column if not exists discounts jsonb default '[]';  -- [{"min":7,"max":27,"rate":0.10}]
alter table plans add column if not exists image_url text;
