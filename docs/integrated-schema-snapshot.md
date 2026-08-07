# integrated Supabase（ycwmybtkebuuxybhlqvf）の適用済みスキーマ

移植の照合用スナップショット。マイグレーションのファイルがあってもクラウドに
適用済みとは限らないため、「実際に動いていたコードが依存していたカラム」を残す。
このプロジェクトを削除してもここを見れば照合できる。

取得日: 2026-08-08 / テーブル数: 33

## access_keys
- id: string uuid
- reservation_id: string uuid
- room_id: string uuid
- door_pin: string text
- provider: string text
- switchbot_key_id: integer integer
- status: string public.access_key_status
- valid_from: string timestamp with time zone
- valid_until: string timestamp with time zone
- issued_at: string timestamp with time zone
- revoked_at: string timestamp with time zone
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## audit_logs
- id: string uuid
- actor_email: string text
- action: string text
- entity_type: string text
- entity_id: string uuid
- summary: string text
- metadata:  jsonb
- created_at: string timestamp with time zone

## blocked_dates
- id: string uuid
- room_type_id: string uuid
- start_date: string date
- end_date: string date
- reason: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- facility_id: string uuid

## booking_rules
- id: string uuid
- room_type_id: string uuid
- name: string text
- start_date: string date
- end_date: string date
- min_nights: integer integer
- max_nights: integer integer
- advance_cutoff_days: integer integer
- gap_days: integer integer
- closed_weekdays: array integer[]
- is_active: boolean boolean
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## cleaning_tasks
- id: string uuid
- title: string text
- category: string text
- sort_order: integer integer
- is_required: boolean boolean
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## customer_tags
- customer_id: string uuid
- tag_id: string uuid

## customers
- id: string uuid
- auth_user_id: string uuid
- last_name: string text
- first_name: string text
- email: string text
- phone: string text
- is_member: boolean boolean
- is_blacklisted: boolean boolean
- blacklist_reason: string text
- visit_count: integer integer
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- last_name_kana: string text
- first_name_kana: string text
- prefecture: string text
- city: string text
- address: string text
- building: string text
- facility_id: string uuid

## facility
- id: string uuid
- name: string text
- address: string text
- phone: string text
- check_in_time: string time without time zone
- check_out_time: string time without time zone
- cancel_policy:  jsonb
- settings:  jsonb
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- slug: string text
- status: string text
- public_site_enabled: boolean boolean
- organization_id: string uuid

## guest_messages
- id: string uuid
- message_type: string text
- subject: string text
- body: string text
- timing: string text
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## ical_sources
- id: string uuid
- name: string text
- url: string text
- source_type: string text
- room_type_id: string uuid
- is_active: boolean boolean
- last_synced_at: string timestamp with time zone
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## inquiries
- id: string uuid
- customer_id: string uuid
- name: string text
- email: string text
- title: string text
- body: string text
- status: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- facility_id: string uuid

## integration_settings
- key: string text
- label: string text
- category: string text
- value: string text
- is_secret: boolean boolean
- description: string text
- placeholder: string text
- sort_order: integer integer
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## notification_templates
- id: string uuid
- trigger: string text
- channel: string text
- subject: string text
- body: string text
- send_offset_hours: integer integer
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- facility_id: string uuid

## operation_reminders
- id: string uuid
- reminder_type: string text
- target_date: string date
- channel: string text
- sent_to: string text
- payload:  jsonb
- sent_at: string timestamp with time zone

## options
- id: string uuid
- name: string text
- price: integer integer
- unit: string text
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- facility_id: string uuid

## organizations
- id: string uuid
- name: string text
- slug: string text
- status: string text
- plan: string text
- settings:  jsonb
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## payment_adjustments
- id: string uuid
- reservation_id: string uuid
- adjustment_type: string text
- amount: integer integer
- status: string text
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## payments
- id: string uuid
- reservation_id: string uuid
- stripe_payment_intent_id: string text
- stripe_checkout_session_id: string text
- amount: integer integer
- fee: integer integer
- refunded_amount: integer integer
- status: string public.payment_status
- receipt_url: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## plan_prices
- id: string uuid
- plan_id: string uuid
- room_type_id: string uuid
- price_per_night: integer integer
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- guest_prices:  jsonb
- pricing_rule:  jsonb

## plans
- id: string uuid
- name: string text
- description: string text
- meal_type: string text
- sale_period: string daterange
- is_active: boolean boolean
- sort_order: integer integer
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- long_description: string text
- tags:  jsonb
- discounts:  jsonb
- image_url: string text
- facility_id: string uuid

## post_stay_followups
- id: string uuid
- reservation_id: string uuid
- status: string text
- channel: string text
- sent_to: string text
- note: string text
- sent_at: string timestamp with time zone
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## properties
- id: string uuid
- name: string text
- address: string text
- phone: string text
- check_in_time: string time without time zone
- check_out_time: string time without time zone
- switchbot_keypad_device_id: string text
- google_calendar_id: string text
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## reservation_checkins
- id: string uuid
- reservation_id: string uuid
- secret_code: string text
- status: string public.checkin_status
- pre_registered_at: string timestamp with time zone
- identity_verified_at: string timestamp with time zone
- checked_in_at: string timestamp with time zone
- whereby_room_url: string text
- whereby_host_room_url: string text
- cleaning_confirmed: boolean boolean
- notes: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## reservation_cleaning_tasks
- id: string uuid
- reservation_id: string uuid
- cleaning_task_id: string uuid
- completed: boolean boolean
- completed_at: string timestamp with time zone
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## reservation_guests
- id: string uuid
- reservation_id: string uuid
- guest_order: integer integer
- full_name: string text
- address: string text
- contact: string text
- occupation: string text
- gender: string text
- is_foreign_national: boolean boolean
- nationality: string text
- passport_number: string text
- passport_image_url: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- birth_date: string date

## reservation_options
- reservation_id: string uuid
- option_id: string uuid
- qty: integer integer

## reservations
- id: string uuid
- code: string text
- customer_id: string uuid
- plan_id: string uuid
- room_type_id: string uuid
- room_id: string uuid
- check_in: string date
- check_out: string date
- nights: integer integer
- num_guests: integer integer
- amount: integer integer
- status: string public.reservation_status
- payment_status: string public.payment_status
- source: string text
- gcal_event_id: string text
- note: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- check_in_time: string time without time zone
- num_children: integer integer
- survey: string text
- lookup_token: string text
- cancel_reason: string text
- cancel_category: string text
- cancelled_at: string timestamp with time zone
- archived_at: string timestamp with time zone
- property_id: string uuid
- facility_id: string uuid

## room_types
- id: string uuid
- name: string text
- description: string text
- capacity: integer integer
- base_price: integer integer
- amenities:  jsonb
- images:  jsonb
- sort_order: integer integer
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- property_id: string uuid
- facility_id: string uuid

## rooms
- id: string uuid
- room_type_id: string uuid
- name: string text
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- property_id: string uuid

## seasonal_rates
- id: string uuid
- room_type_id: string uuid
- plan_id: string uuid
- start_date: string date
- end_date: string date
- price_per_night: integer integer
- label: string text
- is_active: boolean boolean
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## site_links
- id: string uuid
- label: string text
- url: string text
- category: string text
- description: string text
- is_active: boolean boolean
- sort_order: integer integer
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
- update_interval_days: integer integer
- last_updated_at: string timestamp with time zone
- next_update_at: string timestamp with time zone

## surveys
- id: string uuid
- reservation_id: string uuid
- nps_score: integer integer
- answers:  jsonb
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone

## tags
- id: string uuid
- name: string text
- color: string text
- created_at: string timestamp with time zone
- updated_at: string timestamp with time zone
