import Link from "next/link";
import { headers } from "next/headers";
import { SubmitButton } from "@/app/admin/_components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCheckInTime } from "@/lib/reservations";
import type {
  ReservationWithRefs,
  RoomType,
  Room,
  Plan,
  Customer,
  ReservationStatus,
  PaymentStatus,
} from "@/types/db";
import {
  createReservation,
  updateReservation,
  archiveReservation,
} from "./actions";
import { CustomerPicker } from "./CustomerPicker";
import { DateField } from "./DateField";
import { EditToggle } from "./EditToggle";
import { BookingGuide } from "./BookingGuide";
import { bookingGuideSubject, bookingGuideText } from "@/lib/booking-guide";
import { ensureSecretCode, registerUrl } from "@/lib/guest-registration";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const btnPrimary =
  "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700";

const STATUS: { value: ReservationStatus; label: string; cls: string }[] = [
  { value: "pending", label: "仮予約", cls: "bg-gray-100 text-gray-700" },
  { value: "confirmed", label: "確定", cls: "bg-cyan-50 text-cyan-700" },
  { value: "checked_in", label: "チェックイン", cls: "bg-emerald-50 text-emerald-700" },
  { value: "checked_out", label: "チェックアウト", cls: "bg-gray-100 text-gray-600" },
  { value: "cancelled", label: "キャンセル", cls: "bg-red-50 text-red-600" },
  { value: "no_show", label: "ノーショー", cls: "bg-amber-50 text-amber-700" },
];
const statusMeta = (s: ReservationStatus) =>
  STATUS.find((x) => x.value === s) ?? STATUS[0];

const PAYMENT: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "未回収" },
  { value: "paid", label: "回収済み" },
  { value: "authorized", label: "オーソリ済み" },
  { value: "partially_refunded", label: "一部返金" },
  { value: "refunded", label: "返金済み" },
  { value: "failed", label: "決済失敗" },
];
const paymentLabel = (s: PaymentStatus) =>
  PAYMENT.find((x) => x.value === s)?.label ?? s;
const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const supabase = createAdminClient();

  let q = supabase
    .from("reservations")
    .select(
      "*, customers(id,last_name,first_name), room_types(id,name), rooms(id,name), plans(id,name), access_keys(door_pin,status)",
    )
    .is("archived_at", null)
    .order("check_in", { ascending: false });
  if (status) q = q.eq("status", status);

  const [
    { data: resData },
    { data: types },
    { data: rooms },
    { data: plans },
    { data: customers },
    { data: facility },
  ] = await Promise.all([
    q,
    supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("rooms").select("*").eq("is_active", true).order("name"),
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("facility").select("check_in_time, check_out_time, phone").limit(1).maybeSingle(),
  ]);

  const reservations = (resData ?? []) as ReservationWithRefs[];

  // 予約時メールの案内文をここで組む。名簿フォームのURLは予約ごとの secret_code で作る。
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host") ?? "reserve.gh-nissei.jp"}`;
  const guides = new Map<string, { subject: string; body: string }>();
  await Promise.all(
    reservations
      .filter((r) => r.status !== "cancelled")
      .map(async (r) => {
        const secret = await ensureSecretCode(supabase, r.id);
        guides.set(r.id, {
          subject: bookingGuideSubject(r.code),
          body: bookingGuideText({
            guestName: custName(r.customers),
            code: r.code,
            checkIn: r.check_in,
            checkOut: r.check_out,
            checkInTime: ((facility?.check_in_time as string | null) ?? "15:00").slice(0, 5),
            checkOutTime: ((facility?.check_out_time as string | null) ?? "10:00").slice(0, 5),
            numGuests: r.num_guests,
            planName: r.plans?.name ?? null,
            doorPin: r.access_keys?.status === "issued" ? r.access_keys.door_pin : null,
            registerUrl: registerUrl(origin, secret),
            phone: (facility?.phone as string | null) ?? null,
          }),
        });
      }),
  );
  const roomTypes = (types ?? []) as RoomType[];
  const roomList = (rooms ?? []) as Room[];
  const planList = (plans ?? []) as Plan[];
  const customerList = (customers ?? []) as Customer[];

  // チェックイン日の年→月でフォルダ分け。reservations は check_in 降順なので挿入順もそのまま新しい順になる。
  const byYear = new Map<string, Map<string, ReservationWithRefs[]>>();
  for (const r of reservations) {
    const [y, m] = r.check_in.split("-");
    let months = byYear.get(y);
    if (!months) {
      months = new Map();
      byYear.set(y, months);
    }
    let list = months.get(m);
    if (!list) {
      list = [];
      months.set(m, list);
    }
    list.push(r);
  }
  const now = new Date();
  const curYear = String(now.getFullYear());
  const curMonth = String(now.getMonth() + 1).padStart(2, "0");

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">予約</h1>
          <p className="mt-1 text-sm text-gray-600">予約の登録・ステータス管理・客室割当</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href="/admin/export/reservations" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">CSV出力</a>
          <Link href="/admin/reservations/archive" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">アーカイブ一覧</Link>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* 新規予約 */}
      <details className="rounded-2xl border border-gray-200 bg-white p-5" open={reservations.length === 0}>
        <summary className="cursor-pointer font-medium text-gray-900">＋ 新規予約を登録</summary>
        <form action={createReservation} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <CustomerPicker
            customers={customerList.map((c) => ({
              id: c.id,
              label: [c.last_name, c.first_name].filter(Boolean).join(" ") || c.email || c.id.slice(0, 8),
            }))}
          />
          <label className="space-y-1">
            <span className="text-xs text-gray-600">客室タイプ *</span>
            <select name="room_type_id" required className={field}>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">プラン</span>
            <select name="plan_id" className={field} defaultValue="">
              <option value="">（未指定）</option>
              {planList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <DateField name="check_in" label="チェックイン *" />
          <DateField name="check_out" label="チェックアウト *" />
          <label className="space-y-1">
            <span className="text-xs text-gray-600">人数</span>
            <input type="number" name="num_guests" min={1} defaultValue={1} className={field} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">金額（空欄=自動計算）</span>
            <input type="number" name="amount" min={0} placeholder="基本料金×泊数" className={field} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">支払</span>
            <select name="payment_status" className={field} defaultValue="unpaid">
              {PAYMENT.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">客室割当（任意）</span>
            <select name="room_id" className={field} defaultValue="">
              <option value="">（後で割当）</option>
              {roomList.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <input name="note" placeholder="メモ（任意）" className={`${field} md:col-span-3`} />
          <SubmitButton className={btnPrimary}>登録</SubmitButton>
        </form>
      </details>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/reservations" className={`rounded-full px-3 py-1 text-xs ${!status ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-700"}`}>すべて</Link>
        {STATUS.map((s) => (
          <Link key={s.value} href={`/admin/reservations?status=${s.value}`} className={`rounded-full px-3 py-1 text-xs ${status === s.value ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-700"}`}>
            {s.label}
          </Link>
        ))}
      </div>

      {/* 一覧（年 → 月 でフォルダ分け） */}
      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-sm text-gray-500">予約がありません。</p>
        )}
        {[...byYear.entries()].map(([y, months]) => {
          const yearCount = [...months.values()].reduce((n, list) => n + list.length, 0);
          return (
            <details key={y} open={y === curYear} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <summary className="cursor-pointer px-5 py-3 font-medium text-gray-900">
                📁 {y}年
                <span className="ml-2 text-sm font-normal text-gray-500">{yearCount}件</span>
              </summary>
              <div className="space-y-3 border-t border-gray-200 bg-gray-50 p-3">
                {[...months.entries()].map(([m, list]) => (
                  <details key={m} open={y === curYear && m === curMonth} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-800">
                      📁 {Number(m)}月
                      <span className="ml-2 text-xs font-normal text-gray-500">{list.length}件</span>
                    </summary>
                    <div className="space-y-3 border-t border-gray-200 p-3">
                      {list.map((r) => (
                        <ReservationCard
                          key={r.id}
                          r={r}
                          roomTypes={roomTypes}
                          roomList={roomList}
                          planList={planList}
                          customerList={customerList}
                          guide={guides.get(r.id) ?? null}
                        />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function ReservationCard({
  r,
  roomTypes,
  roomList,
  planList,
  customerList,
  guide,
}: {
  r: ReservationWithRefs;
  roomTypes: RoomType[];
  roomList: Room[];
  planList: Plan[];
  customerList: Customer[];
  guide: { subject: string; body: string } | null;
}) {
  const meta = statusMeta(r.status);
  // 発行済みの鍵だけ見せる。失効・取消済みのPINを出しても混乱するだけなので。
  const activeKey = r.access_keys?.status === "issued" ? r.access_keys : null;
  return (
            <details className="rounded-2xl border border-gray-200 bg-white p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                  <span className="font-mono text-xs text-gray-500">{r.code}</span>
                  <span className="font-medium text-gray-900">{custName(r.customers)}</span>
                </span>
                <span className="text-sm text-gray-600">
                  {r.check_in} <span className="text-cyan-700">{formatCheckInTime(r.check_in_time)}着</span> → {r.check_out}（{r.nights}泊） / {r.room_types?.name ?? "—"}
                  {r.rooms ? ` ${r.rooms.name}` : ""} / ¥{r.amount.toLocaleString()}
                </span>
              </summary>

              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
                  <span>人数: {r.num_guests}名</span>
                  <span>チェックイン時間: {formatCheckInTime(r.check_in_time)}</span>
                  <span>プラン: {r.plans?.name ?? "—"}</span>
                  <span>経路: {r.source}</span>
                  <span>支払: {paymentLabel(r.payment_status)}</span>
                  {activeKey && (
                    <span>
                      ドアPIN:{" "}
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-medium text-gray-900">
                        {activeKey.door_pin}
                      </span>
                    </span>
                  )}
                </div>
                {r.note && <p className="text-sm text-gray-700">メモ: {r.note}</p>}
                {r.status === "cancelled" && (r.cancel_category || r.cancel_reason) && (
                  <p className="text-sm text-red-700">
                    キャンセル理由: {r.cancel_category}
                    {r.cancel_reason ? ` / ${r.cancel_reason}` : ""}
                  </p>
                )}

                {guide && <BookingGuide subject={guide.subject} body={guide.body} />}

                <EditToggle
                  actions={
                    <form action={archiveReservation}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">アーカイブに移動</SubmitButton>
                    </form>
                  }
                >
                  {/* 保存後に最新値でフォームを作り直す（defaultValue は再レンダーでは更新されないため） */}
                  <form key={r.updated_at} action={updateReservation} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input type="hidden" name="id" value={r.id} />
                    <CustomerPicker
                      customers={customerList.map((c) => ({
                        id: c.id,
                        label: [c.last_name, c.first_name].filter(Boolean).join(" ") || c.email || c.id.slice(0, 8),
                      }))}
                      defaultCustomerId={r.customer_id}
                    />
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">ステータス</span>
                      <select name="status" defaultValue={r.status} className={field}>
                        {STATUS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">支払</span>
                      <select name="payment_status" defaultValue={r.payment_status} className={field}>
                        {PAYMENT.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">客室タイプ *</span>
                      <select name="room_type_id" required defaultValue={r.room_type_id ?? ""} className={field}>
                        {roomTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">プラン</span>
                      <select name="plan_id" defaultValue={r.plan_id ?? ""} className={field}>
                        <option value="">（未指定）</option>
                        {planList.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">客室割当</span>
                      <select name="room_id" defaultValue={r.room_id ?? ""} className={field}>
                        <option value="">未割当</option>
                        {roomList.map((rm) => (
                          <option key={rm.id} value={rm.id}>{rm.name}</option>
                        ))}
                      </select>
                    </label>
                    <DateField name="check_in" label="チェックイン *" defaultValue={r.check_in} />
                    <DateField name="check_out" label="チェックアウト *" defaultValue={r.check_out} />
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">人数</span>
                      <input type="number" name="num_guests" min={1} defaultValue={r.num_guests} className={field} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">金額</span>
                      <input type="number" name="amount" min={0} defaultValue={r.amount} className={field} />
                    </label>
                    <input name="note" defaultValue={r.note ?? ""} placeholder="メモ（任意）" className={`${field} md:col-span-3`} />
                    <SubmitButton className={btnPrimary}>保存</SubmitButton>
                  </form>
                </EditToggle>
              </div>
            </details>
  );
}
