import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, bookingConfirmedHtml, ownerBookingHtml, ownerEmails } from "@/lib/email";
import { notifyOwner, newBookingMessage } from "@/lib/notify";
import { gcalCreateEvent } from "@/lib/gcal";

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
        if (cust?.email) {
          await sendEmail({ to: cust.email, subject: `【日靜】ご予約確定（${r.code}）`, html: bookingConfirmedHtml(info) }).catch(() => {});
        }
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
      }
    }
  }

  return NextResponse.json({ received: true });
}
