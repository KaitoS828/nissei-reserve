import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 知人向けなどの任意金額Stripe決済リンクの短縮版。
// Stripe Checkout の実URLは長大でLINE等に貼りづらいため、ここで肩代わりする。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservations")
    .select("custom_payment_link_url, custom_payment_link_expires_at")
    .eq("custom_payment_link_token", token)
    .maybeSingle();

  const expired =
    !data?.custom_payment_link_expires_at ||
    new Date(data.custom_payment_link_expires_at) < new Date();

  if (!data?.custom_payment_link_url || expired) {
    return new NextResponse(
      "この決済リンクは無効化されているか、期限切れです。お手数ですが宿泊施設までお問い合わせください。",
      { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  return NextResponse.redirect(data.custom_payment_link_url, { status: 302 });
}
