# nissei予約システム 詳細設計書

> RESERVA を置き換える自作予約・決済システム。対象は **広尾町のサウナ宿（nissei）1施設専用**。
> 月額維持費ゼロ・全機能フル開放・広告なしを目標とする。

最終更新: 2026-06-03

---

## 1. 目的とゴール

| 項目 | 内容 |
|---|---|
| 背景 | RESERVA の維持管理料・有料機能ロック・管理画面の広告混入を解消したい |
| ゴール | 宿泊予約 → Stripe決済 → Googleカレンダー同期 → LINE通知 を自動で回す自前システム |
| 非ゴール | マルチテナント / 多店舗 / 他業種汎用化（将来検討。今回は単一施設に最適化） |
| 利用者 | 管理者=本人（1〜数名）、予約者=一般ゲスト |

---

## 2. スコープ（RESERVA機能の自作対応表）

🟢=Phase1-2で実装 / 🔵=Phase3-4 / ⚪=将来

| RESERVA機能 | 自作対応 | 優先 |
|---|---|---|
| 予約カレンダー（月表示）・予約リスト | 管理カレンダー＋リスト | 🟢 |
| 予約確認・予約登録（管理者手動） | 予約CRUD | 🟢 |
| 予約不可（休業日） | blocked_dates | 🟢 |
| 空き状況 | availability算出 | 🟢 |
| 客室タイプ/客室/宿泊プラン登録 | マスタCRUD | 🟢 |
| 顧客管理・顧客リスト・検索 | customers + フィルタ | 🟢 |
| ダッシュボード（本日チェックイン/アウト等） | 管理トップ | 🟢 |
| カード決済・決済履歴・返金 | **Stripe** | 🟢 |
| 書類発行（領収書/請求書） | Stripe Receipt + PDF | 🔵 |
| Googleカレンダー連携 | **GAS 双方向同期** | 🔵 |
| LINE連携（予約確認・リマインド） | **LINE Messaging API** | 🔵 |
| 通知テンプレート・リマインド・来店お礼 | notification_templates + cron | 🔵 |
| 会員機能・ブラックリスト | customer.is_member / is_blacklisted | 🔵 |
| 顧客アンケート・NPS | surveys | ⚪ |
| 集計・分析（予約/キャンセル/顧客/売上/NPS） | analytics ダッシュボード | 🔵 |
| 多言語・固定文言変更 | i18n（既存サイトに en/zh あり） | ⚪ |
| SEO対策・サイト埋め込み・予約ボタン | 公開サイト最適化＋埋め込みscript | ⚪ |
| セキュリティ（IP制限・2FA） | Supabase Auth + MFA | 🔵 |
| スマートロック連携 | 将来（API次第） | ⚪ |

---

## 3. 技術スタック

| レイヤ | 採用 |
|---|---|
| フロント/サーバ | **Next.js 15（App Router, Route Handlers）+ Tailwind CSS 4** |
| デザイン | ダークテーマ（bg-gray-950）+ シアンアクセント |
| DB / 認証 / ストレージ | **Supabase（PostgreSQL + Auth + Storage + RLS）** |
| 決済 | **Stripe（Checkout / Payment Intents / Webhook / Refund）** |
| カレンダー同期 | **Google Apps Script（GASウェブアプリ）↔ Googleカレンダー** |
| メッセージ | **LINE Messaging API**（Push）+ メール（Resend or Supabase SMTP） |
| 定期実行 | Vercel Cron もしくは Supabase Scheduled Functions / GASトリガー |
| ホスティング | Vercel（フロント+API）、Supabase（マネージドDB） |
| ポート（ローカル） | フロント 3033（3030 は nissei-reserve-integrated と衝突するため変更） |

> 別バックエンド（FastAPI）は立てない。Next.js の Route Handlers + Supabase で完結させ、個人運用の保守コストを最小化する。

---

## 4. システム構成

```
                ┌───────────────────────────────┐
   ゲスト ────▶ │ 公開予約サイト  /(reserve)     │  Next.js
                │  空き状況 → プラン選択 → 決済   │
                └──────────────┬────────────────┘
                               │ Route Handlers (/api/*)
管理者 ──▶ /admin (要認証) ────┤
                               ▼
                ┌──────────────────────────┐     ┌──────────┐
                │ Supabase (PostgreSQL/RLS) │◀───▶│  Stripe  │ Checkout/Webhook
                └──────┬───────────────────┘     └──────────┘
                       │ DB Webhook / API
            ┌──────────┴───────────┐
            ▼                      ▼
   ┌─────────────────┐    ┌──────────────────┐
   │ GAS Webアプリ    │    │ LINE Messaging   │
   │ ↔ Googleカレンダー│    │ 予約確認/リマインド│
   └─────────────────┘    └──────────────────┘
```

既存の静的サイト `nissei`（広尾町のサウナ宿HP）は公開サイトとして残し、「予約する」ボタンから本システムへ遷移させる。

---

## 5. 画面一覧

### 5.1 公開側（ゲスト）
| パス | 画面 | 内容 |
|---|---|---|
| `/reserve` | 予約トップ | 日程・人数選択、空室カレンダー |
| `/reserve/plans` | プラン選択 | 客室タイプ×プラン、料金、オプション |
| `/reserve/form` | 予約フォーム | 顧客情報入力（会員はログイン） |
| `/reserve/checkout` | 決済 | Stripe Checkout へ遷移 |
| `/reserve/complete` | 完了 | 予約番号、確認メール/LINE案内 |
| `/reserve/lookup` | 予約照会/キャンセル | 予約番号＋認証で確認・変更・取消 |

### 5.2 管理側（`/admin`、要認証）
| パス | 画面 | 対応RESERVA画像 |
|---|---|---|
| `/admin` | ダッシュボード（本日チェックイン/アウト、ToDo、売上、問合せ） | 画像6 |
| `/admin/calendar` | 予約カレンダー（月/週） | 画像1 |
| `/admin/reservations` | 予約リスト・検索・登録・編集 | 画像1 |
| `/admin/blocked` | 予約不可（休業日）設定 | - |
| `/admin/customers` | 顧客リスト・検索・タグ・ブラックリスト | 画像4 |
| `/admin/payments` | カード決済履歴・返金・領収書 | 画像7 |
| `/admin/analytics` | 集計・分析 | 画像5 |
| `/admin/masters/room-types` | 客室タイプ登録 | 画像3 |
| `/admin/masters/rooms` | 客室登録 | 画像3 |
| `/admin/masters/plans` | 宿泊プラン登録 | 画像3 |
| `/admin/settings/facility` | 施設情報 | 画像3 |
| `/admin/settings/notifications` | 通知テンプレート・リマインド | 画像2 |
| `/admin/settings/integrations` | Stripe / Googleカレンダー / LINE 連携 | 画像2 |
| `/admin/settings/security` | IP制限・2FA | 画像2 |

---

## 6. データモデル（PostgreSQL / Supabase）

> 命名は snake_case、全テーブルに `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` を持たせる（以下では省略表記）。

### 6.1 マスタ

```sql
-- 施設情報（単一施設なので1行運用 or key-value）
create table facility (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- 例: nissei サウナ宿
  address text,
  phone text,
  check_in_time time default '15:00',
  check_out_time time default '10:00',
  cancel_policy jsonb,           -- {days_before: rate} 例 {"7":0,"3":0.5,"0":1.0}
  settings jsonb default '{}'    -- 任意の拡張設定
);

create table room_types (        -- 客室タイプ（デラックスシングル等）
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity int not null default 2,   -- 定員
  base_price int not null,            -- 基本料金（円/泊）
  amenities jsonb default '[]',       -- 設備
  images jsonb default '[]',
  sort_order int default 0,
  is_active boolean default true
);

create table rooms (             -- 客室（101号室等）
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id) on delete restrict,
  name text not null,            -- 例: 101
  is_active boolean default true
);

create table plans (             -- 宿泊プラン（素泊まり/朝食付き/夏休み限定等）
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  meal_type text,                -- none/breakfast/dinner/both
  sale_period daterange,         -- 販売期間
  is_active boolean default true,
  sort_order int default 0
);

create table plan_prices (       -- プラン×客室タイプの料金
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  room_type_id uuid references room_types(id) on delete cascade,
  price_per_night int not null,
  unique(plan_id, room_type_id)
);

create table options (           -- オプションメニュー（追加サウナ室貸切等）
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null,
  unit text default 'per_stay',  -- per_stay/per_night/per_person
  is_active boolean default true
);
```

### 6.2 顧客

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id), -- 会員ログイン時のみ
  last_name text, first_name text,
  email text, phone text,
  is_member boolean default false,
  is_blacklisted boolean default false,
  blacklist_reason text,
  visit_count int default 0,
  note text
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null, color text
);
create table customer_tags (
  customer_id uuid references customers(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (customer_id, tag_id)
);
```

### 6.3 予約・在庫・決済

```sql
create type reservation_status as enum
  ('pending','confirmed','checked_in','checked_out','cancelled','no_show');
create type payment_status as enum
  ('unpaid','authorized','paid','refunded','partially_refunded','failed');

create table reservations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- 予約番号（人間可読）
  customer_id uuid references customers(id),
  plan_id uuid references plans(id),
  room_type_id uuid references room_types(id),
  room_id uuid references rooms(id),  -- 割当（後から確定可、null許容）
  check_in date not null,
  check_out date not null,            -- 連泊対応
  nights int generated always as (check_out - check_in) stored,
  num_guests int not null default 1,
  amount int not null,                -- 合計金額
  status reservation_status default 'pending',
  payment_status payment_status default 'unpaid',
  source text default 'web',          -- web/admin/line
  gcal_event_id text,                 -- Googleカレンダー同期ID
  note text
);

create table reservation_options (
  reservation_id uuid references reservations(id) on delete cascade,
  option_id uuid references options(id),
  qty int default 1,
  primary key (reservation_id, option_id)
);

create table blocked_dates (          -- 予約不可（休業・メンテ）
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid references room_types(id), -- null=全タイプ休業
  start_date date not null,
  end_date date not null,
  reason text
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount int not null,
  fee int,                            -- Stripe手数料
  refunded_amount int default 0,
  status payment_status not null,
  receipt_url text
);
```

> **空室判定ロジック**: ある `room_type` の日付Dの空き = `rooms`数(該当type, active) − Dを含む `reservations`数(status in pending/confirmed/checked_in) − `blocked_dates`該当数。連泊は各泊で判定。同時予約の二重取りは予約確定トランザクション内で `SELECT ... FOR UPDATE` 相当のロック or Supabase の排他制御で防ぐ。

### 6.4 通知・問合せ・アンケート

```sql
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,    -- booking_confirmed/reminder/thanks/cancelled
  channel text not null,    -- email/line
  subject text, body text,  -- {{name}} {{check_in}} 等の差込変数
  send_offset_hours int,    -- リマインド: チェックインの何時間前
  is_active boolean default true
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text, email text, title text, body text,
  status text default 'open'   -- open/answered/closed
);

create table surveys (        -- アンケート/NPS
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  nps_score int,              -- 0-10
  answers jsonb
);
```

### 6.5 RLS方針
- `auth.users` のうち管理者ロール（`app_metadata.role = 'admin'`）のみ管理系テーブルを全操作可。
- ゲストはサーバ側（service role キー）経由でのみ書き込み。公開クライアントから直接 Supabase は読み取り（空室・プラン）のみに限定。
- 顧客は `auth_user_id = auth.uid()` の自分の予約のみ参照可（会員機能）。

---

## 7. API設計（Next.js Route Handlers）

> `/app/api/**/route.ts`。公開系はレート制限、管理系は Supabase セッション必須。

### 7.1 公開
| Method | パス | 用途 |
|---|---|---|
| GET | `/api/availability?from=&to=&guests=` | 空室・料金算出 |
| GET | `/api/plans` / `/api/room-types` | 公開マスタ |
| POST | `/api/reservations` | 仮予約作成 → Stripe Checkout Session 返却 |
| POST | `/api/stripe/webhook` | 決済確定→`confirmed`化、通知・カレンダー連携トリガー |
| GET | `/api/reservations/lookup?code=&token=` | 予約照会 |
| POST | `/api/reservations/:id/cancel` | キャンセル（ポリシーで返金額算出） |
| POST | `/api/inquiries` | 問合せ送信 |

### 7.2 管理（要認証）
| Method | パス | 用途 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/room-types` `/rooms` `/plans` `/options` | マスタCRUD |
| GET/POST/PATCH | `/api/admin/reservations` | 予約一覧・登録・ステータス変更・客室割当 |
| GET/POST/DELETE | `/api/admin/blocked-dates` | 休業日 |
| GET/PATCH | `/api/admin/customers` | 顧客・タグ・ブラックリスト |
| POST | `/api/admin/payments/:id/refund` | 返金 |
| GET | `/api/admin/analytics?type=&period=` | 集計 |
| GET/PUT | `/api/admin/settings/*` | 施設・通知・連携設定 |

---

## 8. 外部連携設計

### 8.1 Stripe（決済）
1. 予約フォーム送信 → `/api/reservations` が `reservations`(pending) を作成し **Checkout Session** を生成。
2. ゲストが Stripe Checkout で支払い（カード/Apple Pay/Google Pay）。
3. `checkout.session.completed` Webhook 受信 → `payments` 記録、`reservations.status=confirmed`、`payment_status=paid`。
4. 後続で通知・カレンダー登録をトリガー。
5. キャンセル時は `cancel_policy` から返金率算出 → Refund API。
6. 領収書は Stripe の `receipt_url` を利用、必要に応じPDF整形。
- 環境変数: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`。

### 8.2 GAS ↔ Googleカレンダー（双方向）
- **システム→カレンダー（送信）**: 予約 `confirmed` 時、Next.js が GASウェブアプリの `doPost` に予約JSONをPOST。GASが `CalendarApp` でイベント作成し `gcal_event_id` を返却→Supabaseへ保存。更新/取消も同経路。
- **カレンダー→システム（受信）**: GASの時間主導トリガー（例: 15分毎）が対象カレンダーを走査し、手動で入れた予定を `blocked_dates` として Supabase REST(service role) へ反映。これで「カレンダー側で塞いだ枠＝予約不可」を実現。
- 認証: GASは施設オーナーのGoogleアカウント権限で動作。Next.js→GAS は共有シークレット（クエリ/ヘッダ）で保護。
- 環境変数: `GAS_WEBAPP_URL` / `GAS_SHARED_SECRET`。

### 8.3 LINE Messaging API（通知）
- 予約確定・前日リマインド・来店お礼を **Push Message** で送信。
- 友だち追加時の `userId` を `customers` に紐付け（LINEログイン or QR）。
- リマインドは Cron（Vercel Cron / GASトリガー）で `notification_templates.send_offset_hours` を満たす予約を抽出して送信。
- 環境変数: `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET`。

---

## 9. 認証・セキュリティ
- 管理画面: Supabase Auth（メール+パスワード）、`role=admin` をミドルウェアで検証。MFA(2FA) 有効化（RESERVA画像2「情報確認時の認証」相当）。
- 管理画面IP制限: Vercel Middleware で許可IPリストを照合（RESERVA「IPアドレス制限」相当）。
- Webhook: Stripe署名検証、GAS共有シークレット、LINE署名検証。
- 個人情報: 顧客テーブルはRLSで保護、service roleキーはサーバ専用環境変数のみ。

---

## 10. フェーズ別ロードマップ

| Phase | 内容 | 完了条件（検証） |
|---|---|---|
| **0 基盤** | Next.jsプロジェクト、Supabase接続、スキーマ適用、認証 | `/admin` にログインできる |
| **1 コア予約** | マスタCRUD、空室算出、予約カレンダー、予約登録、顧客管理、ダッシュボード | 管理者が手動で予約を作成・カレンダー表示できる |
| **2 決済** | 公開予約フォーム、Stripe Checkout、Webhook、決済履歴、返金、領収書 | ゲストがWebで予約→決済→確定まで通る |
| **3 連携** | GASカレンダー双方向、LINE/メール通知、リマインドCron | 予約確定でカレンダー登録＆LINE通知が飛ぶ |
| **4 高度機能** | 会員機能、ブラックリスト、通知テンプレ、IP制限、2FA、書類発行 | 有料相当機能が管理画面から使える |
| **5 分析** | 予約/キャンセル/顧客/売上/NPS ダッシュボード | 主要KPIがグラフ表示される |

---

## 11. ディレクトリ構成（想定）

```
nissei-reserve/
├─ docs/
│  └─ design.md            ← 本書
├─ src/
│  ├─ app/
│  │  ├─ (public)/reserve/...   公開予約フロー
│  │  ├─ admin/...              管理画面
│  │  └─ api/...                Route Handlers
│  ├─ components/               UI（ダーク/シアン）
│  ├─ lib/
│  │  ├─ supabase/              client/server
│  │  ├─ stripe/
│  │  ├─ line/
│  │  └─ availability.ts        空室算出
│  └─ types/
├─ supabase/
│  └─ migrations/               SQL（§6）
├─ gas/
│  └─ Code.gs                   カレンダー双方向同期
└─ .env.local
```

---

## 12. 環境変数一覧

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# GAS / Google Calendar
GAS_WEBAPP_URL=
GAS_SHARED_SECRET=
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
# Mail (任意)
RESEND_API_KEY=
```

---

## 13. 未決事項（実装着手前に確定したい点）
1. 客室タイプ・客室・プランの **実データ**（サウナ宿の実際の部屋数・料金・プラン名）。
2. キャンセルポリシーの返金率（例: 7日前まで無料 / 3日前50% / 当日100%）。
3. 連泊を許可するか、1泊単位か。
4. 会員機能（リピーター割引・ログイン）を Phase1 から入れるか Phase4 か。
5. 通知チャネルの優先（LINE優先 / メール優先 / 両方）。
6. 既存 `nissei` サイトと同一ドメインにするか、サブドメイン（例: reserve.nissei...）か。
