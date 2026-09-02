-- blocked_dates に Google カレンダーイベントIDカラムを追加
alter table blocked_dates
  add column if not exists gcal_event_id text;
