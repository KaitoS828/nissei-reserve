// キャンセル返金計算（施設の cancel_policy を使用）
// policy {days_before: charge_rate} 例 {"7":0,"3":0.5,"0":1.0}
//   = 7日以上前 請求0(全額返金) / 3〜6日前 50% / 0〜2日前 100%

export function chargeRate(
  policy: Record<string, number> | null,
  daysBefore: number,
): number {
  if (!policy) return 0;
  const keys = Object.keys(policy).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (daysBefore >= k) return policy[String(k)];
  }
  // どの閾値にも満たない = 一番期日が近い（当日以降）。
  // ここで 0 を返すと、宿泊が終わった予約をキャンセルして全額返金できてしまう。
  // 一番小さい閾値の料率＝最も厳しい料率を適用する。
  const strictest = keys[keys.length - 1];
  return strictest === undefined ? 0 : policy[String(strictest)];
}

export function daysUntil(checkIn: string, today = new Date()): number {
  const ci = new Date(`${checkIn}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((ci.getTime() - base.getTime()) / 86400000);
}

export type RefundPreview = {
  daysBefore: number;
  chargeRate: number;     // 請求率（キャンセル料率）
  feeAmount: number;      // キャンセル料
  refundAmount: number;   // 返金額
};

export function computeRefund(
  amount: number,
  checkIn: string,
  policy: Record<string, number> | null,
  today = new Date(),
): RefundPreview {
  const daysBefore = daysUntil(checkIn, today);
  const rate = chargeRate(policy, daysBefore);
  const feeAmount = Math.round(amount * rate);
  return {
    daysBefore,
    chargeRate: rate,
    feeAmount,
    refundAmount: Math.max(0, amount - feeAmount),
  };
}

export const CANCEL_CATEGORIES = [
  "予定が変わった",
  "体調不良",
  "天候・交通の都合",
  "料金・プランの変更希望",
  "その他",
] as const;
