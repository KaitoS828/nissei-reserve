-- キャンセル申請: 理由・カテゴリ・日時を記録
alter table reservations add column if not exists cancel_reason text;
alter table reservations add column if not exists cancel_category text;
alter table reservations add column if not exists cancelled_at timestamptz;
