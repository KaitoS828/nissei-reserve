"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { computeRefund } from "@/lib/cancel";
import { sendEmail, cancellationHtml, cancellationSubject, ownerCancellationHtml, ownerEmails } from "@/lib/email";
import { notifyOwner, cancellationMessage, notifyFailure } from "@/lib/notify";
import { gcalDeleteEvent } from "@/lib/gcal";
import { revokeDoorPin } from "@/lib/smart-lock";
import { isLocale, localePath, type Locale } from "@/lib/i18n";

// エラーは文言ではなくコードでURLに載せる（表示側で言語ごとに引く）。
function back(locale: Locale, code: string, email: string, errCode: string): never {
  const q = new URLSearchParams({ code, email, error: errCode });
  redirect(`${localePath(locale, "/reserve/cancel")}?${q.toString()}`);
}

export async function confirmCancel(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const email = String(formData.get("email") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? "ja");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ja";

  if (!category) back(locale, code, email, "category_required");

  const supabase = createAdminClient();
  const { data: resv } = await supabase
    .from("reservations")
    .select("id, code, check_in, amount, status, payment_status, gcal_event_id, customers(email, last_name, first_name)")
    .eq("code", code)
    .maybeSingle();

  const cust = resv?.customers as unknown as { email: string; last_name: string | null; first_name: string | null } | null;
  const custEmail = cust?.email;
  if (!resv || custEmail !== email) back(locale, code, email, "not_found");
  if (resv!.status === "cancelled") back(locale, code, email, "already_cancelled");

  const { data: facility } = await supabase.from("facility").select("cancel_policy").limit(1).single();
  const { refundAmount } = computeRefund(
    resv!.amount,
    resv!.check_in,
    (facility?.cancel_policy ?? null) as Record<string, number> | null,
  );

  // Stripe 返金
  if (refundAmount > 0) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id, stripe_payment_intent_id")
      .eq("reservation_id", resv!.id)
      .maybeSingle();
    if (payment?.stripe_payment_intent_id) {
      try {
        await getStripe().refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refundAmount,
        });
        await supabase.from("payments")
          .update({ refunded_amount: refundAmount, status: refundAmount >= resv!.amount ? "refunded" : "partially_refunded" })
          .eq("id", payment.id);
      } catch {
        back(locale, code, email, "refund_failed");
      }
    }
  }

  const payStatus = refundAmount >= resv!.amount ? "refunded" : refundAmount > 0 ? "partially_refunded" : resv!.payment_status;
  await supabase.from("reservations")
    .update({
      status: "cancelled",
      payment_status: payStatus,
      cancel_category: category,
      cancel_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", resv!.id);

  // 通知（失敗しても止めない）
  // 名前未登録のときの既定値。お客様宛メールの宛名に出るので言語を合わせる。
  const name =
    [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") ||
    (locale === "en" ? "Guest" : "お客");
  if (custEmail) {
    await sendEmail({
      to: custEmail,
      subject: cancellationSubject(code, locale),
      html: cancellationHtml({ name, code, refund: refundAmount, locale }),
    })
      .then(async (ok) => { if (!ok) await notifyFailure("キャンセル案内メール", "送信に失敗", { 予約: code, 宛先: custEmail }); })
      .catch((e) => notifyFailure("キャンセル案内メール", e, { 予約: code }));
  }
  await notifyOwner(cancellationMessage({ code, name, category, reason, refund: refundAmount })).catch(() => {});
  const owners = ownerEmails();
  if (owners.length) {
    await sendEmail({
      to: owners,
      subject: `【日靜】予約キャンセル ${code}`,
      html: ownerCancellationHtml({ code, name, category, reason, refund: refundAmount }),
    }).catch(() => {});
  }

  // Googleカレンダーのイベントを削除
  const eventId = (resv as { gcal_event_id?: string | null }).gcal_event_id;
  if (eventId) await gcalDeleteEvent(eventId).catch(() => {});

  // キャンセル後も入れてしまわないよう、ドアPINを無効化する
  await revokeDoorPin(resv.id as string).catch((e) =>
    console.error("ドアPINの無効化に失敗:", e),
  );

  redirect(`${localePath(locale, "/reserve/cancel/done")}?code=${code}`);
}
