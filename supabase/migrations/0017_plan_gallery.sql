-- 0017_plan_gallery.sql
-- 宿泊プランごとのギャラリー写真（複数枚）

alter table plans
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;
