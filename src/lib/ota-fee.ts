export const OTA_SOURCES = [
  { source: "vacation_stay", label: "Vacation STAY（楽天Oyado）" },
  { source: "airbnb", label: "Airbnb" },
  { source: "booking", label: "Booking.com" },
  { source: "rakuten", label: "楽天トラベル" },
] as const;

// このシステムのStripe決済の手数料率(%)。ota_fee_rates に同じ形式で保存する
export const STRIPE_SOURCE = "stripe";

export type OtaFeeRates = Record<string, number>;

// 予約金額（宿の売上）に経路ごとの手数料率(%)を掛ける。未設定の経路は0円。
export function otaFee(amount: number, source: string | null, rates: OtaFeeRates): number {
  const rate = source ? rates[source] : undefined;
  return rate ? Math.round((amount * rate) / 100) : 0;
}
