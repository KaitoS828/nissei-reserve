-- 初期シード（ローカル開発用）
-- 実データ（実際の部屋数・料金・プラン名）が未確定のためサンプル値。
-- 管理画面から編集する前提。キャンセルポリシーは design.md §13 の例を採用。

insert into facility (name, address, phone, check_in_time, check_out_time, cancel_policy)
values (
  'nissei サウナ宿',
  '北海道広尾郡広尾町',
  '',
  '15:00',
  '10:00',
  '{"7":0,"3":0.5,"0":1.0}'::jsonb   -- 7日前まで無料 / 3日前50% / 当日100%
);

-- サンプル客室タイプ
with rt as (
  insert into room_types (name, description, capacity, base_price, sort_order)
  values
    ('スタンダード', 'サウナ付きスタンダードルーム', 2, 18000, 1),
    ('デラックス',   '貸切サウナ付きデラックスルーム', 4, 32000, 2)
  returning id, name
)
-- サンプル客室
insert into rooms (room_type_id, name)
select rt.id, r.name
from rt
join (values
  ('スタンダード', '101'),
  ('スタンダード', '102'),
  ('デラックス',   '201')
) as r(type_name, name) on r.type_name = rt.name;

-- サンプル宿泊プラン
insert into plans (name, description, meal_type, sort_order)
values
  ('素泊まり', '食事なし・サウナ利用込み', 'none', 1),
  ('朝食付き', '地元食材の朝食付き', 'breakfast', 2);
