import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegisterForm, type ExistingGuest } from "./RegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "宿泊者名簿のご記入",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { code } = await params;
  const { error, done } = await searchParams;

  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("reservation_checkins")
    .select("reservation_id, reservations(code, check_in, check_out, num_guests, status)")
    .eq("secret_code", code)
    .maybeSingle();

  const resv = checkin?.reservations as unknown as
    | { code: string; check_in: string; check_out: string; num_guests: number; status: string }
    | null;

  if (!checkin || !resv || resv.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">宿泊者名簿のご記入</h1>
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          このURLは無効です。お手数ですが宿までお問い合わせください。
        </p>
      </div>
    );
  }

  const { data: guestsData } = await supabase
    .from("reservation_guests")
    .select(
      "guest_order, full_name, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url",
    )
    .eq("reservation_id", checkin.reservation_id)
    .order("guest_order");
  const guests = (guestsData ?? []) as ExistingGuest[];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">宿泊者名簿のご記入</h1>
        <p className="mt-2 text-sm text-gray-600">
          旅館業法により、ご宿泊者全員分の記録が必要です。ご宿泊前にご記入をお願いいたします。
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">予約番号</span>
          <span className="font-mono text-gray-900">{resv.code}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">ご宿泊日</span>
          <span className="text-gray-900">
            {resv.check_in} 〜 {resv.check_out}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">ご記入状況</span>
          <span className={guests.length >= resv.num_guests ? "text-teal-700" : "text-gray-900"}>
            {guests.length} / {resv.num_guests} 名
          </span>
        </div>
      </div>

      {done && (
        <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {done}名分のご記入を受け付けました。ありがとうございました。
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <RegisterForm secretCode={code} numGuests={resv.num_guests} existing={guests} />
    </div>
  );
}
