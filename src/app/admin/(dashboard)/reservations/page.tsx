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
} from "./actions";
import { CustomerPicker } from "./CustomerPicker";
import { DateField } from "./DateField";
import { EditToggle } from "./EditToggle";
import { BookingGuide } from "./BookingGuide";
import { ConfirmButton } from "@/components/ConfirmButton";
import { GuestRegistry, type RegistryGuest } from "./GuestRegistry";
import { bookingGuideSubject, bookingGuideText } from "@/lib/booking-guide";
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
const SOURCE_LABEL: Record<string, string> = {
  web: "Web",
  admin: "管理画面",
  phone: "電話",
  ical: "iCal",
  walkin: "飛込み",
};
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
  // 月指定はチェックイン日で絞る
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    query = query.gte("check_in", `${month}-01`).lte("check_in", last);
  }

  const [
    { data: resData },
    { data: types },
    { data: rooms },
    { data: plans },
    { data: customers },
    { data: facility },
  ] = await Promise.all([
    query,
    supabase.from("room_types").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("rooms").select("*").eq("is_active", true).order("name"),
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("facility").select("check_in_time, check_out_time, phone").limit(1).maybeSingle(),
  ]);

  let reservations = (resData ?? []) as ReservationWithRefs[];
  // 氏名は埋め込み先にあるので、取得後に絞る（予約番号でも引けるようにする）
  if (q) {
    const needle = q.trim().toLowerCase();
    reservations = reservations.filter((r) =>
      [custName(r.customers), r.code, r.customers?.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  const ids = reservations.map((r) => r.id);
  const [{ data: deliveries }, { data: registered }] = await Promise.all([
    ids.length
      ? supabase
          .from("guest_message_deliveries")
          .select("reservation_id, sent_at, status")
          .in("reservation_id", ids)
          .eq("message_type", "booking_guide")
          .order("sent_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("reservation_guests")
          .select(
            "reservation_id, guest_order, full_name, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url",
          )
          .in("reservation_id", ids)
          .order("guest_order")
      : Promise.resolve({ data: [] }),
  ]);

  // 送信済みかどうかが分からないと二重送信するので、最後に送れた日時を持つ
  const lastSent = new Map<string, string>();
  for (const d of (deliveries ?? []) as { reservation_id: string; sent_at: string; status: string }[]) {
    if (d.status === "sent" && !lastSent.has(d.reservation_id)) {
      lastSent.set(d.reservation_id, jstDateTime(d.sent_at));
    }
  }
  const registry = new Map<string, RegistryGuest[]>();
  for (const g of (registered ?? []) as (RegistryGuest & { reservation_id: string })[]) {
    const list = registry.get(g.reservation_id) ?? [];
    list.push(g);
    registry.set(g.reservation_id, list);
  }

  // 予約時メールの案内文をここで組む。名簿フォームのURLは予約ごとの secret_code で作る。
  const h = await headers();
  const origin = originFromHeaders(h);
  const guides = new Map<string, { subject: string; body: string }>();
  await Promise.all(
    reservations
      .filter((r) => r.status !== "cancelled")
      .map(async (r) => {
        const secret = await ensureSecretCode(supabase, r.id);
        guides.set(r.id, {
          subject: bookingGuideSubject(custName(r.customers)),
          body: bookingGuideText(
            guideInput(r as unknown as GuideRow, facility as GuideFacility, registerUrl(origin, secret)),
          ),
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
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">お名前・予約番号・メール</span>
          <input name="q" defaultValue={q ?? ""} placeholder="一部でも可" className={field} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">チェックインの月</span>
          <input type="month" name="month" defaultValue={month ?? ""} className={field} />
        </label>
        <SubmitButton className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
          絞り込む
        </SubmitButton>
        {(q || month) && (
          <Link href="/admin/reservations" className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">
            条件をクリア
          </Link>
        )}
        <span className="ml-auto self-center text-sm text-gray-500">{reservations.length}件</span>
      </form>

      {!month && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "すべて" },
            { key: "upcoming", label: "これから" },
            { key: "past", label: "過去" },
          ].map((t) => {
            const params = new URLSearchParams();
            if (t.key !== "all") params.set("range", t.key);
            if (status) params.set("status", status);
            if (q) params.set("q", q);
            const href = `/admin/reservations${params.size ? `?${params}` : ""}`;
            return (
              <Link
                key={t.key}
                href={href}
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

      {/* フィルタ。期間の選択を消さないよう range と検索語は引き継ぐ */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "すべて" }, ...STATUS].map((s) => {
          const params = new URLSearchParams();
          if (s.value) params.set("status", s.value);
          if (range) params.set("range", range);
          if (q) params.set("q", q);
          if (month) params.set("month", month);
          const active = s.value ? status === s.value : !status;
          return (
            <Link
              key={s.value || "all"}
              href={`/admin/reservations${params.size ? `?${params}` : ""}`}
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
  registry,
}: {
  r: ReservationWithRefs;
  roomTypes: RoomType[];
  roomList: Room[];
  planList: Plan[];
  customerList: Customer[];
  guide: { subject: string; body: string } | null;
  lastSentAt: string | null;
  registry: RegistryGuest[];
}) {
  const meta = statusMeta(r.status);
  // 発行済みの鍵だけ見せる。失効・取消済みのPINを出しても混乱するだけなので。
  const activeKey = r.access_keys?.status === "issued" ? r.access_keys : null;
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
                  <span>支払: {paymentLabel(r.payment_status)}</span>
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
