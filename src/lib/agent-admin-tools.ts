// 内部AIチャット（Slack / 管理画面）に追加した管理系ツール。
// 予約情報の編集・お客様へのメール・決済リンク・プラン料金・iCal連携先の管理。
//
// 取り消しにくい操作（メール送信・プラン料金の変更）は confirm=true を付けた呼び出しでのみ実行する。
// confirm なしで呼ぶと内容のプレビューだけを返すので、AIはそれをユーザーに見せて同意を取ってから再呼び出しする。

import type Anthropic from "@anthropic-ai/sdk";
import { randomBytes, randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";
import { auditLog } from "./audit";
import { sendEmail } from "./email";
import { reviewRequestCustomHtml } from "./review-request";
import { getStripe } from "./stripe";
import { siteUrl } from "./site";

type Input = Record<string, unknown>;
type ToolImpl = (input: Input) => Promise<string>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const yen = (n: number) => `¥${n.toLocaleString()}`;

const PAYMENT_STATUSES = ["unpaid", "authorized", "paid", "refunded", "partially_refunded", "failed"];

async function findReservation(code: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, code, customer_id, check_in, check_out, amount, payment_status, note, source, lookup_token, custom_payment_link_url, customers(last_name, first_name, email, phone), plans(name)")
    .eq("code", code)
    .maybeSingle();
  return data as unknown as {
    id: string;
    code: string;
    customer_id: string | null;
    check_in: string;
    check_out: string;
    amount: number;
    payment_status: string;
    note: string | null;
    source: string | null;
    lookup_token: string | null;
    custom_payment_link_url: string | null;
    customers: { last_name: string | null; first_name: string | null; email: string | null; phone: string | null } | null;
    plans: { name: string } | null;
  } | null;
}

async function findPlan(query: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("plans").select("id, name, is_active, plan_prices(id, price_per_night, guest_prices)");
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    is_active: boolean;
    plan_prices: { id: string; price_per_night: number; guest_prices: Record<string, number> | null }[];
  }>;
  const hits = rows.filter((p) => p.name.includes(query));
  return hits;
}

export const adminToolImpls: Record<string, ToolImpl> = {
  async edit_reservation(input) {
    const code = str(input.code);
    const resv = await findReservation(code);
    if (!resv) return `予約番号 ${code} は見つかりません。`;

    const patch: Record<string, unknown> = {};
    if (input.amount != null) {
      const amount = Number(input.amount);
      if (!Number.isInteger(amount) || amount < 0) return "金額は0以上の整数で指定してください。";
      patch.amount = amount;
    }
    if (input.payment_status != null) {
      const ps = str(input.payment_status);
      if (!PAYMENT_STATUSES.includes(ps)) return `支払状況は ${PAYMENT_STATUSES.join(" / ")} のいずれかです。`;
      patch.payment_status = ps;
    }
    if (input.note != null) patch.note = str(input.note) || null;
    if (input.source != null) patch.source = str(input.source) || null;
    if (input.receipt_name != null) patch.receipt_name = str(input.receipt_name) || null;

    const customerPatch: Record<string, unknown> = {};
    for (const k of ["last_name", "first_name", "email", "phone"] as const) {
      if (input[k] != null) customerPatch[k] = str(input[k]) || null;
    }

    if (Object.keys(patch).length === 0 && Object.keys(customerPatch).length === 0) return "変更内容がありません。";

    const supabase = createAdminClient();
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("reservations").update(patch).eq("id", resv.id);
      if (error) return `予約の更新に失敗しました: ${error.message}`;
    }
    if (Object.keys(customerPatch).length) {
      if (!resv.customer_id) return "この予約には顧客が紐付いていないため、顧客情報は変更できません。";
      const { error } = await supabase.from("customers").update(customerPatch).eq("id", resv.customer_id);
      if (error) return `顧客情報の更新に失敗しました: ${error.message}`;
    }

    await auditLog(supabase, {
      action: "reservation_edit_by_assistant",
      entityType: "reservation",
      entityId: resv.id,
      summary: `${code} をAIアシスタントで編集`,
      metadata: { patch, customerPatch },
    }).catch(() => {});

    return `予約 ${code} を更新しました（${[...Object.keys(patch), ...Object.keys(customerPatch).map((k) => `顧客.${k}`)].join(", ")}）。`;
  },

  async send_email(input) {
    const code = str(input.code);
    const subject = str(input.subject);
    const body = str(input.body);
    if (!subject || !body) return "件名と本文を指定してください。";

    const resv = await findReservation(code);
    if (!resv) return `予約番号 ${code} は見つかりません。`;
    const to = resv.customers?.email?.trim();
    if (!to) return `予約 ${code} にはメールアドレスが登録されていません。`;

    if (input.confirm !== true) {
      return `【未送信・確認待ち】以下の内容で送信します。\n宛先: ${to}\n件名: ${subject}\n本文:\n${body}\n\nユーザーの同意を得てから confirm=true で再度呼び出してください。`;
    }

    const supabase = createAdminClient();
    const ok = await sendEmail({ to, subject, html: reviewRequestCustomHtml(body) });
    await supabase.from("guest_message_deliveries").insert({
      reservation_id: resv.id,
      message_type: "custom",
      channel: "email",
      sent_to: to,
      subject,
      status: ok ? "sent" : "failed",
      error: ok ? null : "送信に失敗しました",
      sent_at: new Date().toISOString(),
    });
    await auditLog(supabase, {
      action: "custom_email_send",
      entityType: "reservation",
      entityId: resv.id,
      summary: `${code} のお客様へ「${subject}」を ${to} へ${ok ? "送信" : "送信失敗"}（AIアシスタント）`,
    }).catch(() => {});

    return ok ? `${to} へメールを送信しました。` : "メールの送信に失敗しました。設定をご確認ください。";
  },

  async create_payment_link(input) {
    const code = str(input.code);
    const amount = Number(input.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 9_999_999) return "金額は1円以上9,999,999円以下の整数で指定してください。";

    const resv = await findReservation(code);
    if (!resv) return `予約番号 ${code} は見つかりません。`;

    const supabase = createAdminClient();
    let lookupToken = resv.lookup_token;
    if (!lookupToken) {
      lookupToken = randomUUID();
      await supabase.from("reservations").update({ lookup_token: lookupToken }).eq("id", resv.id);
    }

    const stripe = getStripe();
    // 有効な決済リンクが複数残ると紛らわしいので、前回分は無効化する
    const prevSessionId = resv.custom_payment_link_url?.match(/\/pay\/(cs_[A-Za-z0-9]+)/)?.[1];
    if (prevSessionId) await stripe.checkout.sessions.expire(prevSessionId).catch(() => {});

    const origin = siteUrl();
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      payment_method_types: ["card"],
      ...(resv.customers?.email ? { customer_email: resv.customers.email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: {
              name: `${resv.plans?.name ?? "ご宿泊"}（特別価格）`,
              description: `${resv.check_in} 〜 ${resv.check_out} / 予約番号 ${resv.code}`,
            },
          },
        },
      ],
      metadata: { reservation_id: resv.id, code: resv.code, kind: "admin_custom_payment" },
      expires_at: expiresAt,
      success_url: `${origin}/reserve/complete?code=${resv.code}&token=${lookupToken}`,
      cancel_url: `${origin}/admin/reservations`,
    });
    if (!session.url) return "決済リンクの作成に失敗しました。";

    const linkToken = randomBytes(8).toString("base64url");
    await supabase
      .from("reservations")
      .update({
        amount,
        custom_payment_link_token: linkToken,
        custom_payment_link_url: session.url,
        custom_payment_link_expires_at: new Date(expiresAt * 1000).toISOString(),
      })
      .eq("id", resv.id);

    await auditLog(supabase, {
      action: "payment.custom_link_created",
      entityType: "reservations",
      entityId: resv.id,
      summary: `${yen(amount)} の決済リンクを発行（AIアシスタント）`,
      metadata: { amount, code: resv.code },
    }).catch(() => {});

    return `決済リンクを発行しました（24時間有効・予約の金額も ${yen(amount)} に更新）。\n${origin}/pay/${linkToken}\n※お客様へは自動送信していません。送る場合は send_email を使います。`;
  },

  async list_plans() {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("plans")
      .select("name, is_active, discounts, plan_prices(price_per_night, guest_prices)")
      .order("sort_order");
    const rows = (data ?? []) as unknown as Array<{
      name: string;
      is_active: boolean;
      discounts: unknown;
      plan_prices: { price_per_night: number; guest_prices: Record<string, number> | null }[];
    }>;
    if (rows.length === 0) return "プランが登録されていません。";
    return rows
      .map((p) => {
        const pp = p.plan_prices[0];
        const gp = pp?.guest_prices && Object.keys(pp.guest_prices).length ? `人数別: ${JSON.stringify(pp.guest_prices)}` : `1泊 ${yen(pp?.price_per_night ?? 0)}`;
        return `・${p.name}（${p.is_active ? "公開中" : "非公開"}） ${gp}`;
      })
      .join("\n");
  },

  async update_plan(input) {
    const query = str(input.plan);
    if (!query) return "プラン名を指定してください。";
    const hits = await findPlan(query);
    if (hits.length === 0) return `プラン「${query}」は見つかりません。`;
    if (hits.length > 1) return `「${query}」に複数のプランが該当します: ${hits.map((p) => p.name).join(" / ")}。プラン名をもう少し正確に指定してください。`;
    const plan = hits[0];
    const pp = plan.plan_prices[0];

    const pricePatch: Record<string, unknown> = {};
    if (input.price_per_night != null) {
      const n = Number(input.price_per_night);
      if (!Number.isInteger(n) || n < 0) return "1泊料金は0以上の整数で指定してください。";
      pricePatch.price_per_night = n;
    }
    if (input.guest_prices != null) {
      const gp = input.guest_prices as Record<string, unknown>;
      const entries = Object.entries(gp);
      if (entries.some(([k, v]) => !/^\d+$/.test(k) || !Number.isInteger(Number(v)) || Number(v) < 0)) {
        return "guest_prices は {\"人数\": 料金} の形（例 {\"2\": 20000, \"3\": 30000}）で指定してください。";
      }
      pricePatch.guest_prices = Object.fromEntries(entries.map(([k, v]) => [k, Number(v)]));
    }
    const planPatch: Record<string, unknown> = {};
    if (input.is_active != null) planPatch.is_active = input.is_active === true;

    if (Object.keys(pricePatch).length === 0 && Object.keys(planPatch).length === 0) return "変更内容がありません。";
    if (Object.keys(pricePatch).length && !pp) return `プラン「${plan.name}」に料金が設定されていません。`;

    if (input.confirm !== true) {
      const lines = [`【未変更・確認待ち】プラン「${plan.name}」を次のように変更します。公開サイトの料金・表示に即時反映されます。`];
      if ("price_per_night" in pricePatch) lines.push(`・1泊料金: ${yen(pp.price_per_night)} → ${yen(pricePatch.price_per_night as number)}`);
      if ("guest_prices" in pricePatch) lines.push(`・人数別料金: ${JSON.stringify(pp.guest_prices ?? {})} → ${JSON.stringify(pricePatch.guest_prices)}`);
      if ("is_active" in planPatch) lines.push(`・公開状態: ${plan.is_active ? "公開中" : "非公開"} → ${planPatch.is_active ? "公開中" : "非公開"}`);
      lines.push("ユーザーの同意を得てから confirm=true で再度呼び出してください。");
      return lines.join("\n");
    }

    const supabase = createAdminClient();
    if (Object.keys(pricePatch).length) {
      const { error } = await supabase.from("plan_prices").update(pricePatch).eq("id", pp.id);
      if (error) return `料金の更新に失敗しました: ${error.message}`;
    }
    if (Object.keys(planPatch).length) {
      const { error } = await supabase.from("plans").update(planPatch).eq("id", plan.id);
      if (error) return `プランの更新に失敗しました: ${error.message}`;
    }
    await auditLog(supabase, {
      action: "plan_update_by_assistant",
      entityType: "plan",
      entityId: plan.id,
      summary: `プラン「${plan.name}」をAIアシスタントで変更`,
      metadata: { pricePatch, planPatch },
    }).catch(() => {});
    return `プラン「${plan.name}」を更新しました。`;
  },

  async add_ical_source(input) {
    const name = str(input.name);
    const url = str(input.url);
    if (!name || !url) return "名称とURLは必須です。";
    if (!/^https?:\/\//i.test(url)) return "URLは http:// または https:// で始めてください。";

    const supabase = createAdminClient();
    const { data: rt } = await supabase.from("room_types").select("id").eq("is_active", true).order("sort_order").limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("ical_sources")
      .insert({ name, url, source_type: str(input.source_type) || "external", room_type_id: rt?.id ?? null, updated_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) return `追加に失敗しました: ${error.message}`;
    await auditLog(supabase, {
      action: "ical_source_create",
      entityType: "ical_source",
      entityId: data.id,
      summary: `iCal連携「${name}」を追加（AIアシスタント）`,
    }).catch(() => {});
    return `iCal連携「${name}」を追加しました（id: ${data.id}）。取り込むには sync_ical を実行してください。`;
  },

  async update_ical_source(input) {
    const id = str(input.id);
    if (!id) return "iCal連携先のidを指定してください（list_ical_sources で確認できます）。";
    const patch: Record<string, unknown> = {};
    if (input.name != null) patch.name = str(input.name);
    if (input.url != null) {
      const url = str(input.url);
      if (!/^https?:\/\//i.test(url)) return "URLは http:// または https:// で始めてください。";
      patch.url = url;
    }
    if (input.is_active != null) patch.is_active = input.is_active === true;
    if (Object.keys(patch).length === 0) return "変更内容がありません。";

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ical_sources")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) return `更新に失敗しました: ${error.message}`;
    if (!data) return `id ${id} の連携先は見つかりません。`;
    await auditLog(supabase, {
      action: "ical_source_update",
      entityType: "ical_source",
      entityId: id,
      summary: `iCal連携「${data.name}」を更新（AIアシスタント）`,
      metadata: patch,
    }).catch(() => {});
    return `iCal連携「${data.name}」を更新しました（${Object.keys(patch).join(", ")}）。`;
  },
};

export const ADMIN_TOOLS: Anthropic.Tool[] = [
  {
    name: "edit_reservation",
    description: "予約の情報を編集する。金額・支払状況・備考・予約経路・領収書宛名、およびお客様の氏名・メール・電話。日程・人数・ステータスは update_reservation を使う。顧客情報はその顧客の全予約に反映される。",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string" },
        amount: { type: "number" },
        payment_status: { type: "string", enum: PAYMENT_STATUSES },
        note: { type: "string", description: "備考（空文字で消去）" },
        source: { type: "string", enum: ["admin", "airbnb", "booking", "rakuten", "phone", "walkin", "web"] },
        receipt_name: { type: "string" },
        last_name: { type: "string" },
        first_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["code"],
    },
  },
  {
    name: "send_email",
    description: "予約のお客様へメールを送る。confirm を付けずに呼ぶと宛先・件名・本文のプレビューだけ返し、送信しない。必ずプレビューをユーザーに見せて同意を得てから confirm=true で再度呼ぶこと。",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string" },
        subject: { type: "string" },
        body: { type: "string", description: "本文（プレーンテキスト）" },
        confirm: { type: "boolean", description: "ユーザーが送信に同意した場合のみ true" },
      },
      required: ["code", "subject", "body"],
    },
  },
  {
    name: "create_payment_link",
    description: "任意の金額のStripe決済リンク（24時間有効）を発行し、予約の金額も同額に更新する。前回のリンクは無効になる。お客様へは自動送信しない。発行前に金額をユーザーに確認すること。",
    input_schema: { type: "object", properties: { code: { type: "string" }, amount: { type: "number", description: "円（整数）" } }, required: ["code", "amount"] },
  },
  { name: "list_plans", description: "プランと現在の料金・公開状態の一覧を取得する。", input_schema: { type: "object", properties: {}, required: [] } },
  {
    name: "update_plan",
    description: "プランの料金・公開状態を変更する。公開サイトに即時反映される。confirm を付けずに呼ぶと変更前後のプレビューだけ返し、変更しない。プレビューをユーザーに見せて同意を得てから confirm=true で再度呼ぶこと。",
    input_schema: {
      type: "object",
      properties: {
        plan: { type: "string", description: "プラン名（部分一致）" },
        price_per_night: { type: "number", description: "1泊料金（人数別料金が無いプラン用）" },
        guest_prices: { type: "object", description: "人数別の1泊合計料金。例 {\"2\":20000,\"3\":30000}。最小の人数が最低人数になる" },
        is_active: { type: "boolean", description: "公開するか" },
        confirm: { type: "boolean", description: "ユーザーが変更に同意した場合のみ true" },
      },
      required: ["plan"],
    },
  },
  {
    name: "add_ical_source",
    description: "iCal連携先（Airbnb / Booking.com / 楽天トラベル等）を追加する。",
    input_schema: { type: "object", properties: { name: { type: "string" }, url: { type: "string", description: "iCalのURL" }, source_type: { type: "string" } }, required: ["name", "url"] },
  },
  {
    name: "update_ical_source",
    description: "iCal連携先の名称・URL・有効/無効を変更する。idは list_ical_sources で確認する。",
    input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, url: { type: "string" }, is_active: { type: "boolean" } }, required: ["id"] },
  },
];
