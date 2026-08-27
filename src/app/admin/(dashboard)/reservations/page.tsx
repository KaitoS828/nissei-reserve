import Link from "next/link";
import { headers } from "next/headers";
import { SubmitButton } from "@/components/SubmitButton";
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
  issueDoorPinManually,
  revokeDoorPinManually,
  sendBookingGuideEmail,
  sendReviewRequestEmail,
} from "./actions";
import { CustomerPicker } from "./CustomerPicker";
import { DateField } from "./DateField";
import { EditToggle } from "./EditToggle";
import { BookingGuide } from "./BookingGuide";
import { ReviewRequestGuide } from "./ReviewRequestGuide";
import { ConfirmButton } from "@/components/ConfirmButton";
import { GuestRegistry, type RegistryGuest } from "./GuestRegistry";
import { bookingGuideSubject, bookingGuideText } from "@/lib/booking-guide";
import { reviewRequestSubject, reviewRequestText } from "@/lib/review-request";
import { ensureSecretCode, registerUrl } from "@/lib/guest-registration";
import {
  guideInput,
  originFromHeaders,
  type GuideFacility,
  type GuideRow,
} from "@/lib/booking-guide-server";

const jstDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const btnPrimary =
  "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700";

const STATUS: { value: ReservationStatus; label: string; cls: string }[] = [
  { value: "pending", label: "仮予約", cls: "bg-gray-100 text-gray-700" },
  { value: "confirmed", label: "確定", cls: "bg-cyan-50 text-cyan-700" },
  { value: "checked_in", label: "チェックイン", cls: "bg-emerald-50 text-emerald-700" },
  { value: "checked_out", label: "チェックアウト", cls: "bg-amber-100 text-amber-900 border border-amber-200" },
  { value: "cancelled", label: "キャンセル", cls: "bg-red-50 text-red-600" },
  { value: "no_show", label: "ノーショー", cls: "bg-purple-100 text-purple-800" },
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
const SOURCE_LABEL: Record<string, string> = {
  web: "Web",
  admin: "管理画面（知人・直予約）",
  phone: "電話",
  ical: "iCal",
  walkin: "飛込み・現地",
};
const SOURCES = [
  { value: "admin", label: "管理画面（知人・直予約）" },
  { value: "walkin", label: "飛込み・現地" },
  { value: "phone", label: "電話" },
  { value: "web", label: "Web予約" },
  { value: "ical", label: "iCal" },
];
const sourceLabel = (s: string | null) => (s ? (SOURCE_LABEL[s] ?? s) : "—");

const custName = (c: ReservationWithRefs["customers"]) =>
  c ? [c.last_name, c.first_name].filter(Boolean).join(" ") || "（無名）" : "—";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; done?: string; q?: string; month?: string; range?: string }>;
}) {
  const { status, error, done, q, month, range } = await searchParams;
  const supabase = createAdminClient();

  // 既定は「すべて」。「これから」を既定にすると、チェックアウト済みの予約が
  // 一覧から消えて「予約が無くなった」ように見えるため。
  // 月を指定したときはその月をそのまま出す。
  const view = month ? "all" : (range ?? "all");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

  let query = supabase
    .from("reservations")
    .select(
      "*, customers(id,last_name,first_name,email), room_types(id,name), rooms(id,name), plans(id,name), access_keys(door_pin,status)",
    )
    .is("archived_at", null);
  if (view === "upcoming") {
    query = query.gte("check_out", today).order("check_in", { ascending: true });
  } else if (view === "past") {
    query = query.lt("check_out", today).order("check_in", { ascending: false });
  } else {
    query = query.order("check_in", { ascending: false });
  }
  if (status) query = query.eq("status", status);

  // 月チップ用。期間や月の指定に関係なく同じ並びを出したいので、
  // ここでは状態だけ揃えて全期間を取る。
  let monthsQuery = supabase
    .from("reservations")
    .select("check_in, code, customers(id, last_name, first_name, email)")
    .is("archived_at", null);
  if (status) monthsQuery = monthsQuery.eq("status", status);

  const [
    { data: resData },
    { data: monthRows },
    { data: types },
    { data: rooms },
    { data: plans },
    { data: customers },
    { data: facility },
  ] = await Promise.all([
    query,
    monthsQuery,
    supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("rooms").select("*").eq("is_active", true).order("name"),
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("facility").select("check_in_time, check_out_time, phone").limit(1).maybeSingle(),
  ]);

  let reservations = (resData ?? []) as ReservationWithRefs[];
  // 氏名は埋め込み先にあるので、取得後に絞る（予約番号でも引けるようにする）
  const needle = q?.trim().toLowerCase() ?? "";
  const matchesQuery = (r: {
    code: string;
    customers: Pick<Customer, "id" | "last_name" | "first_name" | "email"> | null;
  }) =>
    !needle ||
    [custName(r.customers), r.code, r.customers?.email ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);

  if (q) reservations = reservations.filter(matchesQuery);

  // 月ごとの件数。チップの表示と、その月に予約があるかの判断に使う。
  type MonthRow = {
    check_in: string;
    code: string;
    customers: Pick<Customer, "id" | "last_name" | "first_name" | "email"> | null;
  };
  const monthCounts = new Map<string, number>();
  for (const r of (monthRows ?? []) as unknown as MonthRow[]) {
    if (!matchesQuery(r)) continue;
    const key = r.check_in.slice(0, 7);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  // 年 → 月 の並び。新しい年を上に出す。
  const monthsByYear = new Map<string, string[]>();
  for (const key of [...monthCounts.keys()].sort().reverse()) {
    const y = key.slice(0, 4);
    monthsByYear.set(y, [...(monthsByYear.get(y) ?? []), key]);
  }

  // 月の絞り込みは取得後に行う。チップの件数が月指定に引きずられないようにするため。
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    reservations = reservations.filter((r) => r.check_in.slice(0, 7) === month);
  }

  // 絞り込みリンクは現在の条件を引き継ぐ。null を渡した項目だけ外す。
  const buildHref = (over: Partial<Record<"range" | "status" | "q" | "month", string | null>>) => {
    const next: Record<string, string | null | undefined> = { range, status, q, month, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (!v) continue;
      if (k === "range" && v === "all") continue;
      p.set(k, v);
    }
    return `/admin/reservations${p.size ? `?${p}` : ""}`;
  };

  const ids = reservations.map((r) => r.id);
  const [{ data: deliveries }, { data: registered }] = await Promise.all([
    ids.length
      ? supabase
          .from("guest_message_deliveries")
          .select("reservation_id, message_type, sent_at, status")
          .in("reservation_id", ids)
          .in("message_type", ["booking_guide", "review_request"])
          .order("sent_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("reservation_guests")
          .select(
            "reservation_id, guest_order, full_name, furigana, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url",
          )
          .in("reservation_id", ids)
          .order("guest_order")
      : Promise.resolve({ data: [] }),
  ]);

  // 送信済みかどうかが分からないと二重送信するので、最後に送れた日時を持つ
  const lastSent = new Map<string, string>();
  const lastSentReview = new Map<string, string>();
  for (const d of (deliveries ?? []) as { reservation_id: string; message_type: string; sent_at: string; status: string }[]) {
    if (d.status === "sent") {
      if (d.message_type === "booking_guide" && !lastSent.has(d.reservation_id)) {
        lastSent.set(d.reservation_id, jstDateTime(d.sent_at));
      } else if (d.message_type === "review_request" && !lastSentReview.has(d.reservation_id)) {
        lastSentReview.set(d.reservation_id, jstDateTime(d.sent_at));
      }
    }
  }
  const registry = new Map<string, RegistryGuest[]>();
  for (const g of (registered ?? []) as (RegistryGuest & { reservation_id: string })[]) {
    const list = registry.get(g.reservation_id) ?? [];
    list.push(g);
    registry.set(g.reservation_id, list);
  }

  // 予約時メールおよびレビュー依頼メールの案内文をここで組む
  const h = await headers();
  const origin = originFromHeaders(h);
  const guides = new Map<string, { subject: string; body: string }>();
  const reviewRequests = new Map<string, { subject: string; body: string }>();
  await Promise.all(
    reservations
      .filter((r) => r.status !== "cancelled")
      .map(async (r) => {
        const secret = await ensureSecretCode(supabase, r.id);
        const guestName = custName(r.customers);
        guides.set(r.id, {
          subject: bookingGuideSubject(guestName),
          body: bookingGuideText(
            guideInput(r as unknown as GuideRow, facility as GuideFacility, registerUrl(origin, secret)),
          ),
        });
        reviewRequests.set(r.id, {
          subject: reviewRequestSubject(guestName),
          body: reviewRequestText({
            guestName,
            code: r.code,
            checkIn: r.check_in,
            checkOut: r.check_out,
            phone: (facility?.phone as string | null) ?? null,
          }),
        });
      }),
  );
  const roomTypes = (types ?? []) as RoomType[];
  const roomList = (rooms ?? []) as Room[];
  const planList = (plans ?? []) as Plan[];
  const customerList = (customers ?? []) as Customer[];

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

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        {status && <input type="hidden" name="status" value={status} />}
        {range && <input type="hidden" name="range" value={range} />}
        {month && <input type="hidden" name="month" value={month} />}
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">お名前・予約番号・メール</span>
          <input name="q" defaultValue={q ?? ""} placeholder="一部でも可" className={field} />
        </label>
        <SubmitButton className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
          絞り込む
        </SubmitButton>
        {(q || month || status || range) && (
          <Link href="/admin/reservations" className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">
            条件をクリア
          </Link>
        )}
        <span className="ml-auto self-center text-sm text-gray-500">{reservations.length}件</span>
      </form>

      {/* 月で辿る。予約がある月だけ出すので、空振りしない。 */}
      {monthCounts.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-gray-200 bg-white p-4">
          <Link
            href={buildHref({ month: null })}
            className={`rounded-full px-3 py-1 text-sm ${
              !month ? "bg-gray-900 font-medium text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            すべての月
          </Link>
          {[...monthsByYear.entries()].map(([year, keys]) => (
            <div key={year} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-400">{year}年</span>
              {keys.map((key) => (
                <Link
                  key={key}
                  href={buildHref({ month: key })}
                  className={`rounded-full px-2.5 py-1 text-sm ${
                    month === key
                      ? "bg-cyan-600 font-medium text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {Number(key.slice(5))}月
                  <span className={`ml-1 text-xs ${month === key ? "text-cyan-100" : "text-gray-400"}`}>
                    {monthCounts.get(key)}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {!month && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "すべて" },
            { key: "upcoming", label: "これから" },
            { key: "past", label: "過去" },
          ].map((t) => {
            return (
              <Link
                key={t.key}
                href={buildHref({ range: t.key === "all" ? null : t.key })}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  view === t.key
                    ? "bg-cyan-600 font-medium text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {done && (
        <p className="rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{done}</p>
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
            <span className="text-xs text-gray-600">予約経路</span>
            <select name="source" className={field} defaultValue="admin">
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
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
          <input name="note" placeholder="メモ（任意: 現金受領済、知り合い割引など）" className={`${field} md:col-span-3`} />
          <SubmitButton className={btnPrimary}>登録</SubmitButton>
        </form>
      </details>

      {/* フィルタ。期間の選択を消さないよう range と検索語は引き継ぐ */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "すべて" }, ...STATUS].map((s) => {
          const active = s.value ? status === s.value : !status;
          return (
            <Link
              key={s.value || "all"}
              href={buildHref({ status: s.value || null })}
              className={`rounded-full px-3 py-1 text-xs ${active ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* 一覧（年 → 月 でフォルダ分け） */}
      <div className="space-y-3">
        {reservations.length === 0 && (
          <p className="text-sm text-gray-500">予約がありません。</p>
        )}
        {/* 日付で追えるよう、開閉するフォルダではなく一続きのリストにする。
            月が変わるところに見出しを挟むだけで、折りたためない＝隠れない。 */}
        {reservations.map((r, i) => {
          const [y, m] = r.check_in.split("-");
          const prev = i > 0 ? reservations[i - 1].check_in.slice(0, 7) : null;
          const showHeading = prev !== `${y}-${m}`;
          return (
            <div key={r.id}>
              {showHeading && (
                <h2 className="sticky top-0 z-10 -mx-1 mb-2 mt-6 bg-gray-50/95 px-1 py-2 text-sm font-semibold text-gray-500 backdrop-blur first:mt-0">
                  {y}年{Number(m)}月
                  <span className="ml-2 font-normal text-gray-400">
                    {reservations.filter((x) => x.check_in.slice(0, 7) === `${y}-${m}`).length}件
                  </span>
                </h2>
              )}
              <ReservationCard
                r={r}
                roomTypes={roomTypes}
                roomList={roomList}
                planList={planList}
                customerList={customerList}
                guide={guides.get(r.id) ?? null}
                lastSentAt={lastSent.get(r.id) ?? null}
                reviewRequest={reviewRequests.get(r.id) ?? null}
                lastSentReviewAt={lastSentReview.get(r.id) ?? null}
                registry={registry.get(r.id) ?? []}
              />
            </div>
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
  lastSentAt,
  reviewRequest,
  lastSentReviewAt,
  registry,
}: {
  r: ReservationWithRefs;
  roomTypes: RoomType[];
  roomList: Room[];
  planList: Plan[];
  customerList: Customer[];
  guide: { subject: string; body: string } | null;
  lastSentAt: string | null;
  reviewRequest: { subject: string; body: string } | null;
  lastSentReviewAt: string | null;
  registry: RegistryGuest[];
}) {
  const meta = statusMeta(r.status);
  // 発行済みの鍵だけ見せる。失効・取消済みのPINを出しても混乱するだけなので。
  const activeKey = r.access_keys?.status === "issued" ? r.access_keys : null;

  // 名簿は旅館業法で全員分の記録が要る。展開しないと分からないと取りこぼすので、
  // 一覧の行に出す。キャンセル・ノーショーは記録の必要がないため出さない。
  const showRegistry = r.status !== "cancelled" && r.status !== "no_show";
  const filled = registry.length;
  const registryMeta = !showRegistry
    ? null
    : filled === 0
      ? { label: "名簿 未", cls: "bg-amber-50 text-amber-700" }
      : filled < r.num_guests
        ? { label: `名簿 ${filled}/${r.num_guests}`, cls: "bg-amber-50 text-amber-700" }
        : { label: `名簿 ${filled}/${r.num_guests}`, cls: "bg-emerald-50 text-emerald-700" };
  return (
            <details className="rounded-2xl border border-gray-200 bg-white p-5">
              {/* 日付 → 状態 → 名前 → 予約番号 の順。日付を先頭に固定幅で置いて、
                  どの行も同じ位置で追えるようにする。客室・金額は展開後に出す。 */}
              <summary className="flex cursor-pointer items-center gap-3">
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="font-medium text-gray-900">{r.check_in}</span>
                  <span className="text-gray-400"> → </span>
                  <span className="text-gray-600">{r.check_out}</span>
                  <span className="ml-1 text-xs text-gray-400">{r.nights}泊</span>
                </span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-gray-900">{custName(r.customers)}</span>
                  <span className="ml-2 font-mono text-xs text-gray-400">{r.code}</span>
                </span>
                {registryMeta && (
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${registryMeta.cls}`}>
                    {registryMeta.label}
                  </span>
                )}
                <span className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                  {sourceLabel(r.source)}
                </span>
              </summary>

              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
                  <span>客室: {r.room_types?.name ?? "—"}{r.rooms ? ` / ${r.rooms.name}` : ""}</span>
                  <span>金額: ¥{r.amount.toLocaleString()}</span>
                  <span>人数: {r.num_guests}名</span>
                  <span>チェックイン時間: {formatCheckInTime(r.check_in_time)}</span>
                  <span>プラン: {r.plans?.name ?? "—"}</span>
                  <span>経路: {sourceLabel(r.source)}</span>
                  <span className="flex items-center gap-2">
                    支払: {paymentLabel(r.payment_status)}
                    {r.payment_status === "paid" && r.lookup_token && (
                      <a
                        href={`/reserve/receipt?code=${r.code}&token=${r.lookup_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-cyan-300 bg-cyan-50/50 px-2.5 py-1 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100"
                      >
                        領収書を発行
                      </a>
                    )}
                  </span>
                  <span className="col-span-2">
                    メール:{" "}
                    {r.customers?.email ? (
                      <a href={`mailto:${r.customers.email}`} className="text-cyan-700 hover:underline">
                        {r.customers.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">未登録</span>
                    )}
                  </span>
                </div>

                {/* 決済が通れば webhook で自動発行される。現地精算や管理画面からの
                    代理予約は webhook を通らないので、ここから手動で出せるようにする。 */}
                {r.status !== "cancelled" && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-600">ドアPIN:</span>
                    {activeKey ? (
                      <>
                        <span className="rounded bg-white px-2 py-1 font-mono text-base font-semibold tracking-wider text-gray-900">
                          {activeKey.door_pin}
                        </span>
                        <form action={revokeDoorPinManually}>
                          <ConfirmButton
                            hidden={{ id: r.id }}
                            danger
                            title="ドアPINを無効化します"
                            message={
                              <>
                                <p>
                                  {custName(r.customers)}様の番号 {activeKey.door_pin} をキーパッドから削除します。
                                  お客様はこの番号で解錠できなくなります。
                                </p>
                                <p className="mt-2">
                                  すでにお客様へお伝えしている場合は、新しい番号の連絡が必要です。
                                </p>
                              </>
                            }
                            confirmLabel="はい、無効化する"
                            className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 transition hover:bg-red-50"
                          >
                            無効化
                          </ConfirmButton>
                        </form>
                        <span className="text-xs text-gray-500">
                          キーパッドに「{custName(r.customers)}様 {r.code}」として登録されています
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-500">未発行</span>
                        <form action={issueDoorPinManually}>
                          <ConfirmButton
                            hidden={{ id: r.id }}
                            title="ドアPINを発行します"
                            message={
                              <>
                                <p>
                                  {custName(r.customers)}様（{r.check_in} 〜 {r.check_out}）の番号を
                                  キーパッドに登録します。
                                </p>
                                <p className="mt-2">滞在期間だけ有効で、期間外は解錠できません。</p>
                              </>
                            }
                            confirmLabel="はい、発行する"
                            className="rounded-lg bg-cyan-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-cyan-700"
                          >
                            ドアPINを発行
                          </ConfirmButton>
                        </form>
                        <span className="text-xs text-gray-500">
                          滞在期間だけ有効な番号をキーパッドに登録します
                        </span>
                      </>
                    )}
                  </div>
                )}
                {r.note && <p className="text-sm text-gray-700">メモ: {r.note}</p>}
                {r.status === "cancelled" && (r.cancel_category || r.cancel_reason) && (
                  <p className="text-sm text-red-700">
                    キャンセル理由: {r.cancel_category}
                    {r.cancel_reason ? ` / ${r.cancel_reason}` : ""}
                  </p>
                )}

                {/* 名簿は法令上の記録なので、内容をそのまま確認できるようにする */}
                {r.status !== "cancelled" && (
                  <GuestRegistry guests={registry} numGuests={r.num_guests} />
                )}

                {guide && (
                  <BookingGuide
                    subject={guide.subject}
                    body={guide.body}
                    email={r.customers?.email ?? null}
                    lastSentAt={lastSentAt}
                    sendAction={sendBookingGuideEmail}
                    reservationId={r.id}
                    hasDoorPin={activeKey !== null}
                  />
                )}

                {reviewRequest && r.status !== "cancelled" && (
                  <ReviewRequestGuide
                    subject={reviewRequest.subject}
                    body={reviewRequest.body}
                    email={r.customers?.email ?? null}
                    lastSentAt={lastSentReviewAt}
                    sendAction={sendReviewRequestEmail}
                    reservationId={r.id}
                  />
                )}

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
                    <label className="space-y-1">
                      <span className="text-xs text-gray-600">予約経路</span>
                      <select name="source" defaultValue={r.source ?? "admin"} className={field}>
                        {SOURCES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <input name="note" defaultValue={r.note ?? ""} placeholder="メモ（任意: 現金受領済、知り合い割引など）" className={`${field} md:col-span-2`} />
                    <input
                      name="receipt_name"
                      defaultValue={r.receipt_name ?? ""}
                      placeholder="領収書の宛名（任意・空欄なら予約者名。「様」は自動で付きます）"
                      className={`${field} md:col-span-2`}
                    />
                    <SubmitButton className={btnPrimary}>保存</SubmitButton>
                  </form>
                </EditToggle>
              </div>
            </details>
  );
}
