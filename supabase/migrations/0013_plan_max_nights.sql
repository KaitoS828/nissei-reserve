-- 日帰りプランを宿泊プランと区別する。
-- これが無いと日帰りが複数泊で売れてしまう（実際に2泊で予約できていた）。
-- null = 泊数の制限なし、1 = 日帰り（1日利用）。
alter table plans add column if not exists max_nights integer;

comment on column plans.max_nights is '予約できる最大泊数。null は制限なし。日帰りプランは 1。';

update plans set max_nights = 1 where name like '%日帰り%' and max_nights is null;
