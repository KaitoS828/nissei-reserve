import { eachNight, type DateStr } from "./availability";

export type Discount = { min: number; max: number | null; rate: number };

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
