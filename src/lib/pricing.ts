import { eachNight, type DateStr } from "./availability";

export type Discount = { min: number; max: number | null; rate: number };

// 人数別料金マップ（キー=人数の文字列, 値=その人数のときの1泊料金）
export type GuestPrices = Record<string, number> | null | undefined;
export type PricingRule = {
  type?: "fixed" | "per_person";
  amount_per_person?: number;
  fixed_amount?: number;
  min_guests?: number;
  max_guests?: number;
  minimum_charge?: number;
};

export function guestPricesFromRule(rule: PricingRule): Record<string, number> {
  const minGuests = Math.max(1, Math.round(rule.min_guests ?? 1));
  const maxGuests = Math.max(minGuests, Math.round(rule.max_guests ?? minGuests));
  const prices: Record<string, number> = {};

  for (let guests = minGuests; guests <= maxGuests; guests++) {
    if (rule.type === "fixed") {
      prices[String(guests)] = Math.round(rule.fixed_amount ?? 0);
    } else {
      const amount = guests * Math.round(rule.amount_per_person ?? 0);
      prices[String(guests)] = Math.max(amount, Math.round(rule.minimum_charge ?? 0));
    }
  }

  return prices;
}

// 人数に応じた1泊単価を求める。guestPrices があればそれを優先し、
// 該当人数のキーが無ければ「その人数を超えない最大キー」、それも無ければ fallback。
export function nightlyRateForGuests(
  guests: number,
  guestPrices: GuestPrices,
  fallbackPerNight: number,
): number {
  if (guestPrices) {
    const exact = guestPrices[String(guests)];
    if (typeof exact === "number" && exact > 0) return exact;
    const keys = Object.keys(guestPrices)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    if (keys.length) {
      const le = keys.filter((k) => k <= guests);
      const pick = le.length ? le[le.length - 1] : keys[0];
      const v = guestPrices[String(pick)];
      if (typeof v === "number" && v > 0) return v;
    }
  }
  return fallbackPerNight;
}

// guest_prices のキーから予約可能な人数レンジを求める。
// 最低人数 = 最小キー（例: サウナ付きは "2" 始まりなら最低2名）。
// 最大人数 = 客室定員（capacity）。キーが無ければ 1〜capacity にフォールバック。
export function guestRange(
  guestPrices: GuestPrices,
  capacity: number,
): { min: number; max: number } {
  const keys = guestPrices
    ? Object.keys(guestPrices)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const max = capacity > 0 ? capacity : keys.length ? Math.max(...keys) : 1;
  const min = keys.length ? Math.min(...keys) : 1;
  return { min, max: Math.max(min, max) };
}

export type PriceBreakdown = {
  nights: number;
  pricePerNight: number;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  total: number;
};

// 連泊数に応じた最良の長期割引を選ぶ
export function pickDiscount(nights: number, discounts: Discount[]): number {
  let best = 0;
  for (const d of discounts) {
    const okMin = nights >= d.min;
    const okMax = d.max == null || nights <= d.max;
    if (okMin && okMax) best = Math.max(best, d.rate);
  }
  return best;
}

export function calcPrice(
  from: DateStr,
  to: DateStr,
  pricePerNight: number,
  discounts: Discount[] = [],
): PriceBreakdown {
  const nights = eachNight(from, to).length;
  const subtotal = nights * pricePerNight;
  const discountRate = pickDiscount(nights, discounts);
  const discountAmount = Math.round(subtotal * discountRate);
  return {
    nights,
    pricePerNight,
    subtotal,
    discountRate,
    discountAmount,
    total: subtotal - discountAmount,
  };
}
