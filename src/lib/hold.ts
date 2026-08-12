// 決済前の仮予約（pending）は在庫を消費する（availability.ts の OCCUPYING_STATUSES）。
// 決済されないまま放置されると、その日は他のお客様が予約できない。
// 実際にチェックイン日を過ぎても pending のまま残っていた予約があった。
//
// 解放の経路は3つ用意する。1つでも取りこぼすと在庫が固まったままになるため。
//   1. お客様が決済画面から戻った（cancel_url）
//   2. Stripe のセッションが期限切れ（checkout.session.expired）
//   3. 上のどちらも届かなかったぶんを拾う定期処理

import type { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** 決済されなかった仮予約の在庫を解放する。すでに確定済みなら何もしない。 */
export async function releaseUnpaidHold(
  supabase: AdminClient,
  reservationId: string,
  reason: string,
): Promise<boolean> {
  // 確定済み・支払済みを巻き込まないよう、条件を絞って更新する
  const { data } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      cancel_category: "未決済",
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .select("id");

  return (data?.length ?? 0) > 0;
}

/** 決済セッションの期限。短すぎると入力中に切れるので、Stripe の下限どおり30分。 */
export const CHECKOUT_WINDOW_MINUTES = 30;

/** この時刻より前に作られた未決済の仮予約は、取りこぼしとみなして解放する。 */
export function staleBefore(now = new Date(), minutes = CHECKOUT_WINDOW_MINUTES + 30): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}
