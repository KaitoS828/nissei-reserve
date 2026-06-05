import Stripe from "stripe";

let _stripe: Stripe | null = null;

// 遅延初期化（キー未設定でもビルドを通すため）
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY が未設定です");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
