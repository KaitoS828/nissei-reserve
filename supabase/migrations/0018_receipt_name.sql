-- 領収書の宛名を予約時に任意指定できるようにする。
-- 空欄なら領収書表示時に customers の氏名にフォールバックする。
alter table reservations add column if not exists receipt_name text;
