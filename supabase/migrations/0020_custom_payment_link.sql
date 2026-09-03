-- 知人向けなどの任意金額Stripe決済リンクを、自ドメイン配下の短いURLで配布できるようにする。
-- Stripe Checkout の実URLは長大なため、短いトークンでリダイレクトする。
alter table reservations add column if not exists custom_payment_link_token text unique;
alter table reservations add column if not exists custom_payment_link_url text;
alter table reservations add column if not exists custom_payment_link_expires_at timestamptz;
