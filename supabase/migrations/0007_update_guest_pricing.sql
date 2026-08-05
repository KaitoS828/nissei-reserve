-- 宿泊料金を人数別料金に更新。
-- 素泊まり: 7,000円/人（1〜6名）
-- 宿泊のKOBU SAUNA付き: 10,000円/人（最低2名、最大6名）
-- 日帰り利用プランは別料金体系のため対象外。

update plan_prices pp
set
  price_per_night = 7000,
  guest_prices = '{"1":7000,"2":14000,"3":21000,"4":28000,"5":35000,"6":42000}'::jsonb
from plans p
where pp.plan_id = p.id
  and p.name = '素泊まりプラン';

update plan_prices pp
set
  price_per_night = 10000,
  guest_prices = '{"2":20000,"3":30000,"4":40000,"5":50000,"6":60000}'::jsonb
from plans p
where pp.plan_id = p.id
  and p.name like '%KOBU%'
  and p.name not like '%日帰り%';
