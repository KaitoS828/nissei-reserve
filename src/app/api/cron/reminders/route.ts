import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { ensureSecretCode, registerUrl } from "@/lib/guest-registration";
import { originFromHeaders } from "@/lib/booking-guide-server";
import { reminderHtml, reminderSubject, tomorrowJst } from "@/lib/reminder";
import { notifyFailure } from "@/lib/notify";

export const dynamic = "force-dynamic";

const MESSAGE_TYPE = "checkin_reminder";

// 明日チェックインの予約にリマインドを送る。
// 案内メールは予約時の一度きりなので、宿泊が近づく頃には埋もれている。
// 名簿が未記入のまま当日を迎えるのも避けたい。
async function handle(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const target = tomorrowJst();

  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      "id, code, check_in, check_out, check_in_time, num_guests, customers(last_name, first_name, email), access_keys(door_pin, status)",
    )
    .eq("check_in", target)
    .in("status", ["pending", "confirmed"])
    .is("archived_at", null);

  const list = (reservations ?? []) as unknown as {
    id: string; code: string; check_in: string; check_out: string;
    check_in_time: string | null; num_guests: number;
    customers: { last_name: string | null; first_name: string | null; email: string | null } | null;
    access_keys: { door_pin: string; status: string } | null;
  }[];

  const { data: facility } = await supabase
    .from("facility")
    .select("check_in_time, phone")
    .limit(1)
    .maybeSingle();

  const origin = originFromHeaders(await headers());
  const results: { code: string; status: string }[] = [];

  for (const r of list) {
    const to = r.customers?.email?.trim();
    if (!to) {
      results.push({ code: r.code, status: "メールアドレス未登録" });
      continue;
    }

    // 同じ宿泊に二度送らない。cron が重なって走っても増えないようにする。
    const { data: already } = await supabase
      .from("guest_message_deliveries")
      .select("id")
      .eq("reservation_id", r.id)
      .eq("message_type", MESSAGE_TYPE)
      .eq("status", "sent")
      .maybeSingle();
    if (already) {
      results.push({ code: r.code, status: "送信済みのため省略" });
      continue;
    }

    const { count } = await supabase
      .from("reservation_guests")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", r.id);

    const secret = await ensureSecretCode(supabase, r.id);
    const guestName =
      [r.customers?.last_name, r.customers?.first_name].filter(Boolean).join(" ") || null;
    const subject = reminderSubject(guestName);
    const lookupUrl = to
      ? `${origin}/reserve/lookup?code=${encodeURIComponent(r.code)}&email=${encodeURIComponent(to)}`
      : null;

    const ok = await sendEmail({
      to,
      subject,
      html: reminderHtml({
        guestName,
        code: r.code,
        checkIn: r.check_in,
        checkOut: r.check_out,
        // 到着時刻の申告があればそれを、無ければ施設の開始時刻
        checkInTime: (r.check_in_time ?? facility?.check_in_time ?? "15:00").slice(0, 5),
        numGuests: r.num_guests,
        registeredGuests: count ?? 0,
        doorPin: r.access_keys?.status === "issued" ? r.access_keys.door_pin : null,
        registerUrl: registerUrl(origin, secret),
        lookupUrl,
        phone: (facility?.phone as string | null) ?? null,
      }),
    }).catch(() => false);
    if (!ok) await notifyFailure("前日リマインドの送信", "送信に失敗", { 予約: r.code, 宛先: to });

    await supabase.from("guest_message_deliveries").insert({
      reservation_id: r.id,
      message_type: MESSAGE_TYPE,
      channel: "email",
      sent_to: to,
      subject,
      status: ok ? "sent" : "failed",
      error: ok ? null : "前日リマインドの送信に失敗しました",
      sent_at: new Date().toISOString(),
    });

    results.push({ code: r.code, status: ok ? "送信" : "送信失敗" });
  }

  return NextResponse.json({ date: target, targets: list.length, results });
}

// Vercel Cron は GET で叩く。外部cron・手動実行は POST を使う。
export const GET = handle;
export const POST = handle;
