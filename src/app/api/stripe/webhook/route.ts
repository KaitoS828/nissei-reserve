import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, ownerBookingHtml, ownerEmails } from "@/lib/email";
import { bookingGuideHtml, bookingGuideSubject } from "@/lib/booking-guide";
import { GUIDE_SELECT, guideInput, type GuideFacility, type GuideRow } from "@/lib/booking-guide-server";
import { ensureSecretCode, registerUrl } from "@/lib/guest-registration";
import { notifyOwner, newBookingMessage, notifyFailure } from "@/lib/notify";
import { gcalCreateEvent } from "@/lib/gcal";
import { issueDoorPin } from "@/lib/smart-lock";
import { releaseUnpaidHold } from "@/lib/hold";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "署名/シークレットがありません" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature error";
    return NextResponse.json({ error: `Webhook検証失敗: ${msg}` }, { status: 400 });
  }

  // 決済されないまま期限切れになったら在庫を解放する。
  // これが無いと、決済画面で離脱した日程が塞がったままになる。
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const reservationId = session.metadata?.reservation_id;
    if (reservationId) {
      const released = await releaseUnpaidHold(
        createAdminClient(),
        reservationId,
        "決済期限切れのため解放",
      );
      if (released) console.info(`未決済の仮予約を解放しました: ${reservationId}`);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const reservationId = session.metadata?.reservation_id;

    if (reservationId && session.payment_status === "paid") {
      const supabase = createAdminClient();

      await supabase
        .from("reservations")
        .update({ status: "confirmed", payment_status: "paid" })
        .eq("id", reservationId);

      await supabase.from("payments").insert({
        reservation_id: reservationId,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        stripe_checkout_session_id: session.id,
        amount: session.amount_total ?? 0,
        status: "paid",
      });

      // 通知（メール: ゲスト / Discord・Slack: オーナー）。失敗しても止めない。
      const { data: r } = await supabase
        .from("reservations")
        .select("code, check_in, check_out, nights, num_guests, amount, plans(name), customers(last_name, first_name, email, phone)")
        .eq("id", reservationId)
        .single();
      if (r) {
        const cust = r.customers as unknown as { last_name: string | null; first_name: string | null; email: string | null; phone: string | null } | null;
        const plan = (r.plans as unknown as { name: string } | null)?.name ?? "ご宿泊";
        const name = [cust?.last_name, cust?.first_name].filter(Boolean).join(" ") || "お客";
        const info = {
          code: r.code as string, name, plan,
          checkIn: r.check_in as string, checkOut: r.check_out as string,
          nights: r.nights as number, guests: r.num_guests as number, amount: r.amount as number,
        };
        await notifyOwner(newBookingMessage(info)).catch(() => {});
        // オーナーにもメール通知
        const owners = ownerEmails();
        if (owners.length) {
          await sendEmail({
            to: owners,
            subject: `【日靜】新規予約 ${r.code}（${info.name}様）`,
            html: ownerBookingHtml({ ...info, email: cust?.email ?? undefined, phone: cust?.phone ?? undefined }),
          }).catch(() => {});
        }

        // Googleカレンダーに登録し event_id を保存
        const eventId = await gcalCreateEvent({
          code: info.code, customer: info.name, plan: info.plan,
          email: cust?.email ?? undefined, phone: cust?.phone ?? undefined,
          check_in: info.checkIn, check_out: info.checkOut,
          guests: info.guests, amount: info.amount,
        }).catch(() => null);
        if (eventId) {
          await supabase.from("reservations").update({ gcal_event_id: eventId }).eq("id", reservationId);
        }

        // ドアPINを発行してキーパッドに登録する。
        // 鍵は滞在期間だけ有効なので、直前でなく確定時に作って構わない。
        const { data: facility } = await supabase
          .from("facility")
          .select("check_in_time, check_out_time, phone")
          .limit(1)
          .maybeSingle();
        await issueDoorPin({
          reservationId,
          checkIn: info.checkIn,
          checkOut: info.checkOut,
          checkInTime: (facility?.check_in_time as string | null)?.slice(0, 5),
          checkOutTime: (facility?.check_out_time as string | null)?.slice(0, 5),
          code: info.code,
          guestName: info.name,
        }).catch((e) => notifyFailure("ドアPINの発行", e, { 予約: info.code }));

        // 案内メールは PIN を載せたいので、発行のあとに送る。
        // 管理画面から送るものと同じ本文・同じ組み立てを使う。
        if (cust?.email) {
          const { data: guideRow } = await supabase
            .from("reservations")
            .select(GUIDE_SELECT)
            .eq("id", reservationId)
            .maybeSingle();
          const secret = await ensureSecretCode(supabase, reservationId);
          const host = req.headers.get("host");
          const origin = host ? `https://${host}` : "https://reserve.gh-nissei.jp";
          const subject = bookingGuideSubject(info.name);
          const lookupUrl = `${origin}/reserve/lookup?code=${encodeURIComponent(info.code)}&email=${encodeURIComponent(cust.email)}`;
          const html = bookingGuideHtml(
            guideInput(guideRow as unknown as GuideRow, facility as GuideFacility, registerUrl(origin, secret), lookupUrl),
          );
          const ok = await sendEmail({ to: cust.email, subject, html }).catch(() => false);
          if (!ok) await notifyFailure("予約時メールの自動送信", "送信に失敗", { 予約: info.code, 宛先: cust.email });

          // 管理画面の送信履歴と同じ場所に残す。送れたかどうかを後から確認できる。
          await supabase.from("guest_message_deliveries").insert({
            reservation_id: reservationId,
            message_type: "booking_guide",
            channel: "email",
            sent_to: cust.email,
            subject,
            status: ok ? "sent" : "failed",
            error: ok ? null : "決済確定時の自動送信に失敗しました",
            sent_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
