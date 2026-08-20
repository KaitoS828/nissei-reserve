-- 0016_guest_furigana.sql
-- 宿泊者名簿テーブルに読み仮名（ふりがな）カラムを追加

alter table if exists reservation_guests
  add column if not exists furigana text;
