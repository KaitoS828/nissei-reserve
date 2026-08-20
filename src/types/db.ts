// 手書きの行型（管理画面で扱う最小集合）。
// 実DBスキーマは supabase/migrations を正とする。

export type IcalSource = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  room_type_id: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomType = {
  id: string;
  facility_id: string | null;
  name: string;
  description: string | null;
  capacity: number;
  base_price: number;
  amenities: string[];
  images: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Room = {
  id: string;
  room_type_id: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  facility_id: string | null;
  auth_user_id: string | null;
  last_name: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  is_member: boolean;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  visit_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Discount = { min: number; max: number | null; rate: number };

export type PricingRule = {
  type?: "fixed" | "per_person";
  amount_per_person?: number;
  fixed_amount?: number;
  min_guests?: number;
  max_guests?: number;
  minimum_charge?: number;
};

export type Plan = {
  id: string;
  facility_id: string | null;
  name: string;
  description: string | null;
  long_description: string | null;
  meal_type: string | null;
  tags: string[];
  discounts: Discount[];
  image_url: string | null;
  gallery_images: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  reservation_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  amount: number;
  fee: number | null;
  refunded_amount: number;
  status: PaymentStatus;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanPrice = {
  id: string;
  plan_id: string;
  room_type_id: string;
  price_per_night: number;
  guest_prices?: Record<string, number> | null;
  pricing_rule?: PricingRule;
};

export type Facility = {
  id: string;
  organization_id: string | null;
  slug: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cancel_policy: Record<string, number> | null;
  status?: "draft" | "active" | "paused" | "archived";
  public_site_enabled?: boolean;
  stripe_connect_account_id?: string | null;
  admin_note?: string | null;
  settings?: Record<string, unknown> | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "paused" | "cancelled";
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "failed";

export type Reservation = {
  id: string;
  facility_id: string | null;
  code: string;
  customer_id: string | null;
  plan_id: string | null;
  room_type_id: string | null;
  room_id: string | null;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  nights: number;
  num_guests: number;
  num_children: number;
  amount: number;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  source: string;
  gcal_event_id: string | null;
  note: string | null;
  survey: Record<string, unknown> | null;
  lookup_token: string | null;
  cancel_category: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AccessKeyStatus = "pending" | "issued" | "revoked" | "expired";

// JOIN 付き取得用
export type ReservationWithRefs = Reservation & {
  customers: Pick<Customer, "id" | "last_name" | "first_name" | "email"> | null;
  room_types: Pick<RoomType, "id" | "name"> | null;
  rooms: Pick<Room, "id" | "name"> | null;
  plans: Pick<Plan, "id" | "name"> | null;
  // select に含めたときだけ入る
  // reservation_id に unique 制約があるので、PostgREST は配列でなく単一オブジェクトを返す
  access_keys?: { door_pin: string; status: AccessKeyStatus } | null;
};

export type OperatingCost = {
  id: string;
  year_month: string; // 'YYYY-MM'
  category: string;
  amount: number;
  description: string | null;
  recorded_date: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLink = {
  id: string;
  title: string;
  url: string;
  category: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

