import { eachNight, type DateStr } from "./availability";

export type Discount = { min: number; max: number | null; rate: number };

// 人数別料金マップ（キー=人数の文字列, 値=その人数のときの1泊料金）
export type GuestPrices = Record<string, number> | null | undefined;

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
