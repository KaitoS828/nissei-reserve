import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENDERS } from "@/lib/guest-registration";
import { submitGuestRegistration } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "宿泊者名簿のご記入",
  robots: { index: false, follow: false },
};

const field =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

type Guest = {
  guest_order: number;
  full_name: string;
  is_foreign_national: boolean;
};

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; done?: string; guest?: string }>;
}) {
  const { code } = await params;
  const { error, done, guest } = await searchParams;

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
    .select("guest_order, full_name, is_foreign_national")
    .eq("reservation_id", checkin.reservation_id)
    .order("guest_order");
  const guests = (guestsData ?? []) as Guest[];

  const nextOrder = guest
    ? Math.max(1, Number(guest))
    : Math.min(resv.num_guests, guests.length + 1);
  const editing = guests.find((g) => g.guest_order === nextOrder);
  const allDone = guests.length >= resv.num_guests && !guest;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">宿泊者名簿のご記入</h1>
        <p className="mt-2 text-sm text-gray-600">
          旅館業法により、ご宿泊者全員ぶんの記録が必要です。ご宿泊前にご記入をお願いいたします。
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
          <span className="text-gray-900">
            {guests.length} / {resv.num_guests} 名
          </span>
        </div>
      </div>

      {done && (
        <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {done}人目の方のご記入を受け付けました。
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {guests.length > 0 && (
        <ul className="space-y-2">
          {guests.map((g) => (
            <li
              key={g.guest_order}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm"
            >
              <span className="text-gray-900">
                {g.guest_order}人目: {g.full_name} 様
              </span>
              <a href={`/register/${code}?guest=${g.guest_order}`} className="text-teal-700 underline">
                修正する
              </a>
            </li>
          ))}
        </ul>
      )}

      {allDone ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
            ご記入ありがとうございました。全員ぶんのご記入が完了しています。
          </p>
          <a
            href={`/register/${code}?guest=${resv.num_guests + 1}`}
            className="block text-center text-sm text-gray-500 underline"
          >
            人数が増えた場合はこちらから追加
          </a>
        </div>
      ) : (
        <form action={submitGuestRegistration} className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <input type="hidden" name="secret_code" value={code} />
          <input type="hidden" name="guest_order" value={nextOrder} />

          <p className="text-sm font-medium text-gray-900">
            {nextOrder}人目の方{editing ? "（修正）" : ""}
          </p>

          <label className="block space-y-1">
            <span className="text-sm text-gray-700">お名前 <span className="text-red-500">*</span></span>
            <input name="full_name" defaultValue={editing?.full_name} required className={field} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-gray-700">ご住所 <span className="text-red-500">*</span></span>
            <input name="address" required placeholder="都道府県から番地まで" className={field} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-gray-700">ご連絡先 <span className="text-red-500">*</span></span>
            <input name="contact" required placeholder="電話番号またはメールアドレス" className={field} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-gray-700">ご職業</span>
            <input name="occupation" className={field} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm text-gray-700">生年月日</span>
              <input type="date" name="birth_date" className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-gray-700">性別</span>
              <select name="gender" defaultValue="" className={field}>
                <option value="">未回答</option>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3 rounded-lg bg-gray-50 p-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_foreign_national" className="h-4 w-4" />
              日本国内に住所をお持ちでない方
            </label>
            <p className="text-xs text-gray-500">
              該当する場合、法令により国籍と旅券番号の記載が必要です。
            </p>
            <label className="block space-y-1">
              <span className="text-sm text-gray-700">国籍</span>
              <input name="nationality" className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-gray-700">旅券番号</span>
              <input name="passport_number" className={field} />
            </label>
          </div>

          <button className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
            この内容で登録する
          </button>
        </form>
      )}
    </div>
  );
}
