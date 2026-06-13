// 手書きの行型（管理画面で扱う最小集合）。
// 実DBスキーマは supabase/migrations を正とする。

export type RoomType = {
  id: string;
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

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  long_description: string | null;
  meal_type: string | null;
  tags: string[];
  discounts: Discount[];
  image_url: string | null;
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
};

export type Facility = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cancel_policy: Record<string, number> | null;
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
  code: string;
  customer_id: string | null;
  plan_id: string | null;
  room_type_id: string | null;
  room_id: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  num_guests: number;
  amount: number;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  source: string;
  gcal_event_id: string | null;
  note: string | null;
  cancel_category: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// JOIN 付き取得用
export type ReservationWithRefs = Reservation & {
  customers: Pick<Customer, "id" | "last_name" | "first_name"> | null;
  room_types: Pick<RoomType, "id" | "name"> | null;
  rooms: Pick<Room, "id" | "name"> | null;
  plans: Pick<Plan, "id" | "name"> | null;
};
