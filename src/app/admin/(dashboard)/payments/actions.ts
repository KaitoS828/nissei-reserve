"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/payments";

// 決済記録の削除（管理画面の履歴から消すだけ。Stripe 上の決済は残る）
export async function deletePayment(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(PATH);
}

// 管理者による返金（全額 or 一部）
export async function refundPayment(formData: FormData) {
  const paymentId = String(formData.get("payment_id"));
  const amountInput = Number(formData.get("amount") ?? 0);
  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, reservation_id, amount, refunded_amount, stripe_payment_intent_id")
    .eq("id", paymentId)
    .single();
  if (!payment) redirect(`${PATH}?error=${encodeURIComponent("決済が見つかりません")}`);

  const remaining = payment!.amount - (payment!.refunded_amount ?? 0);
  const refundAmount = amountInput > 0 ? Math.min(amountInput, remaining) : remaining;
  if (refundAmount <= 0) redirect(`${PATH}?error=${encodeURIComponent("返金可能額がありません")}`);

  if (!payment!.stripe_payment_intent_id) {
    redirect(`${PATH}?error=${encodeURIComponent("Stripe決済が紐づいていません")}`);
  }

  try {
    await getStripe().refunds.create({
      payment_intent: payment!.stripe_payment_intent_id!,
      amount: refundAmount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "返金失敗";
    redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
  }

  const totalRefunded = (payment!.refunded_amount ?? 0) + refundAmount;
  const fullyRefunded = totalRefunded >= payment!.amount;

  await supabase
    .from("payments")
    .update({
      refunded_amount: totalRefunded,
      status: fullyRefunded ? "refunded" : "partially_refunded",
    })
    .eq("id", paymentId);

  if (payment!.reservation_id) {
    await supabase
      .from("reservations")
      .update({
        payment_status: fullyRefunded ? "refunded" : "partially_refunded",
        ...(fullyRefunded ? { status: "cancelled" } : {}),
      })
      .eq("id", payment!.reservation_id);
  }

  await auditLog(supabase, {
    action: "payment.refund",
    entityType: "payments",
    entityId: paymentId,
    summary: `¥${refundAmount.toLocaleString()} を返金（${fullyRefunded ? "全額" : "一部"}）`,
    metadata: {
      refundAmount,
      totalRefunded,
      fullyRefunded,
      reservationId: payment!.reservation_id,
    },
  });

  revalidatePath(PATH);
  redirect(`${PATH}?ok=1`);
}
