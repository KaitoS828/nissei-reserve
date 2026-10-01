-- 0023_reservation_tax_exempt.sql
-- 宿泊税の課税免除（修学旅行等の学校行事の参加者・引率者）の人数。0なら全員が課税対象。
alter table reservations
  add column if not exists tax_exempt_persons integer not null default 0 check (tax_exempt_persons >= 0);
