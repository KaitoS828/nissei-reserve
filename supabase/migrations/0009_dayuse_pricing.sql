-- 日帰り利用プラン【KOBU SAUNA】の料金改定
-- 2〜4名: 10,000円固定 / 5名以降: 1名あたり+1,500円 / 定員6名
-- "1"キーを持たせないことで1名予約を不可に（最低2名）

update plan_prices pp
set
  price_per_night = 10000,
  guest_prices = '{"2":10000,"3":10000,"4":10000,"5":11500,"6":13000}'::jsonb
from plans p
where pp.plan_id = p.id
  and p.name like '%日帰り%';
