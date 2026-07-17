-- 宿泊プランの料金・定員の更新（対象は「素泊まり」と「宿泊のサウナ付き」の2プランのみ）
-- 素泊まりプラン:                     7,000円/人（1名〜6名）
-- プライベートサウナ付きプラン【KOBU】: 10,000円/人（最低2名〜定員6名。"1"キーなしで1名予約を不可に）
-- ※「日帰り利用プラン【KOBU】」「テスト」は対象外（別料金体系のため触らない）

-- 客室定員を6名に（プランが参照する客室タイプのみ。既に6なら実質no-op）
update room_types
set capacity = 6
where id in (select room_type_id from plan_prices)
  and capacity < 6;

-- 素泊まりプラン
update plan_prices pp
set
  price_per_night = 7000,
  guest_prices = '{"1":7000,"2":14000,"3":21000,"4":28000,"5":35000,"6":42000}'::jsonb
from plans p
where pp.plan_id = p.id
  and p.name = '素泊まりプラン';

-- 宿泊のプライベートサウナ付きプラン（日帰りは除外）
update plan_prices pp
set
  price_per_night = 10000,
  guest_prices = '{"2":20000,"3":30000,"4":40000,"5":50000,"6":60000}'::jsonb
from plans p
where pp.plan_id = p.id
  and p.name like '%KOBU%'
  and p.name not like '%日帰り%';
