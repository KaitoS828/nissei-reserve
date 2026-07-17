-- Phase 2 セットアップ: スキーマ拡張 + 実データ投入
-- Dashboard → SQL Editor で実行してください

-- ===== 0003_public.sql =====
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

-- ===== seed_real.sql =====
-- 実データ投入（スクショの一棟貸し宿「日靜」より）
-- サンプル/テストデータを全削除して実データに差し替える。

delete from reservation_options;
delete from reservations;
delete from rooms;
delete from plan_prices;
delete from plans;
delete from room_types;
delete from facility;

-- 施設
insert into facility (name, address, phone, check_in_time, check_out_time, cancel_policy)
values (
  '一棟貸し宿「日靜」',
  '北海道広尾郡広尾町音調津733番地 日靜',
  '07021516275',
  '15:00',
  '10:00',
  '{"7":0,"3":0.5,"0":1.0}'::jsonb
);

-- 客室タイプ（1日1組・1棟貸し）
with rt as (
  insert into room_types (name, description, capacity, base_price, amenities, sort_order)
  values (
    '日靜（1日1組限定）',
    '広尾町の大自然に囲まれた一棟貸しのゲストハウス。1日1組限定の貸切。',
    6,
    28000,
    '["無料WiFi","洗浄機付トイレ","エアコン","冷蔵庫","電気ポット","コーヒーメーカー/お茶セット","ドライヤー","洗濯機","乾燥機","電子レンジ","バス","トイレ","タオル","バスタオル","ボディーソープ","シャンプー","コンディショナー","ハミガキセット","スリッパ","敷地内無料駐車場"]'::jsonb,
    1
  )
  returning id
)
insert into rooms (room_type_id, name)
select id, '日靜' from rt;

-- プラン
insert into plans (name, description, long_description, meal_type, tags, discounts, sort_order)
values
(
  '素泊まりプラン',
  '【素泊まり】大自然に囲まれたゲストハウスで自由気ままに過ごす、シンプルステイプラン',
  E'【素泊まり】大自然に囲まれたゲストハウスで自由気ままに過ごす、シンプルステイプラン\n\n食事やスケジュールに縛られず、自由な旅を楽しみたい方に最適な素泊まりプランです。\nビジネスでのご利用、十勝・広尾町の観光の拠点、あるいは大自然の中でただのんびりと過ごすおこもり宿としてもご利用いただけます。\n\n■ 本プランの特徴\n自由なスケジュール：チェックイン後は、ご自身のペースで自由に出入りしていただけます。\n快適な共有スペース：館内には、他の旅行者や地域の人々と交流を楽しめるスペースをご用意しています。\n周辺のアクティビティ：大自然を活かしたアウトドアや観光など、アクティブに動く旅の拠点に最適です。\n\n※本プランにはお食事が含まれておりません。地域の美味しいローカルフードを楽しんだり、お好きな食材を持ち込んで自由な滞在をお愉しみください。',
  'none',
  '["1棟貸し","禁煙","長期割"]'::jsonb,
  '[{"min":7,"max":27,"rate":0.10},{"min":28,"max":null,"rate":0.20}]'::jsonb,
  1
),
(
  'プライベートサウナ付きプラン【KOBU SAUNA】',
  '完全プライベートな本格サウナ「KOBU SAUNA」を贅沢に独り占めできる特別な宿泊プラン',
  E'広尾町の豊かな自然に囲まれたゲストハウスで、完全プライベートな本格サウナ「KOBU SAUNA」を贅沢に独り占めできる特別な宿泊プランです。\n\n誰の目も気にすることなく、お好きなタイミングでお好きなだけロウリュを愉しむ。心地よい熱気に包まれた後は、北海道の清らかな水と澄み切った外気の中で、これまでにない究極の「ととのい」をご体感いただけます。\n\n忙しい日常を忘れ、五感が研ぎ澄まされる静寂のひとときをお過ごしください。',
  'none',
  '["1棟貸し","禁煙","長期割"]'::jsonb,
  '[{"min":7,"max":27,"rate":0.15},{"min":28,"max":null,"rate":0.20}]'::jsonb,
  2
);

-- プラン料金（プラン×客室タイプ）
insert into plan_prices (plan_id, room_type_id, price_per_night, guest_prices)
select p.id, rt.id,
  case when p.name like '%KOBU%' then 10000 else 7000 end,
  case
    when p.name like '%KOBU%' then '{"2":20000,"3":30000,"4":40000,"5":50000,"6":60000}'::jsonb
    else '{"1":7000,"2":14000,"3":21000,"4":28000,"5":35000,"6":42000}'::jsonb
  end
from plans p cross join room_types rt;
