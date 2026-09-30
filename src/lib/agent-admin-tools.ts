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
  async get_analytics(input) {
    const year = str(input.year) || String(new Date().getFullYear());
    const month = str(input.month).padStart(2, "0");
    if (!/^\d{4}$/.test(year)) return "year は YYYY で指定してください。";
    if (str(input.month) && !/^(0[1-9]|1[0-2])$/.test(month)) return "month は 1〜12 で指定してください。";
    const prefix = str(input.month) ? `${year}-${month}` : year;
    // check_in は date 型で like が使えないので範囲で絞る
    const from = str(input.month) ? `${year}-${month}-01` : `${year}-01-01`;
    const to = str(input.month)
      ? (month === "12" ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`)
      : `${Number(year) + 1}-01-01`;

    const supabase = createAdminClient();
    const [{ data: resvData }, { data: costData }, { count: roomCount }] = await Promise.all([
      supabase.from("reservations").select("status, payment_status, amount, check_in, nights").is("archived_at", null).gte("check_in", from).lt("check_in", to),
      supabase.from("operating_costs").select("category, amount").like("year_month", `${prefix}%`),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    const rows = (resvData ?? []) as { status: string; payment_status: string; amount: number; nights: number | null }[];
    const costs = (costData ?? []) as { category: string; amount: number }[];

    const revenue = rows.filter((r) => r.payment_status === "paid").reduce((a, r) => a + r.amount, 0);
    const totalCost = costs.reduce((a, c) => a + c.amount, 0);
    const profit = revenue - totalCost;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const nights = rows.filter((r) => !["cancelled", "no_show"].includes(r.status)).reduce((a, r) => a + (r.nights ?? 0), 0);
    const days = str(input.month)
      ? new Date(Number(year), Number(month), 0).getDate()
      : (Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0) ? 366 : 365);
    const available = (roomCount ?? 0) * days;

    const byCategory = new Map<string, number>();
    for (const c of costs) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + c.amount);
    const costLines = [...byCategory].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ・${k}: ${yen(v)}`);

    return [
      `【${str(input.month) ? `${year}年${Number(month)}月` : `${year}年`}の集計】（チェックイン日ベース・除外済み予約は含まない）`,
      `確定売上（支払済）: ${yen(revenue)}`,
      `経費: ${yen(totalCost)}${costLines.length ? "\n" + costLines.join("\n") : ""}`,
      `粗利益: ${yen(profit)}（利益率 ${revenue > 0 ? Math.round((profit / revenue) * 100) : 0}%）`,
      `予約数: ${rows.length}件 / 延べ宿泊: ${nights}泊 / キャンセル: ${cancelled}件（${rows.length ? Math.round((cancelled / rows.length) * 100) : 0}%）`,
      `稼働率: ${available > 0 ? `${Math.round((nights / available) * 1000) / 10}%（${nights}泊 / 提供可能${available}泊）` : "—（稼働中の客室なし）"}`,
    ].join("\n");
  },

  async list_costs(input) {
    const ym = str(input.year_month);
    if (ym && !/^\d{4}(-\d{2})?$/.test(ym)) return "year_month は YYYY-MM（または年のみ YYYY）で指定してください。";
    const supabase = createAdminClient();
    let q = supabase.from("operating_costs").select("id, year_month, category, amount, description, recorded_date").order("year_month", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    if (ym) q = q.like("year_month", `${ym}%`);
    const { data } = await q;
    const rows = (data ?? []) as { id: string; year_month: string; category: string; amount: number; description: string | null; recorded_date: string | null }[];
    if (rows.length === 0) return "該当する経費はありません。";
    return rows.map((c) => `・${c.year_month} | ${c.category} | ${yen(c.amount)}${c.description ? ` | ${c.description}` : ""} | id: ${c.id}`).join("\n");
  },

  async add_cost(input) {
    const ym = str(input.year_month);
    if (!/^\d{4}-\d{2}$/.test(ym)) return "年月は YYYY-MM で指定してください。";
    const amount = Number(input.amount);
    if (!Number.isInteger(amount) || amount < 0) return "金額は0以上の整数で指定してください。";
    const category = str(input.category) || "その他";
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("operating_costs")
      .insert({ year_month: ym, category, amount, description: str(input.description) || null, recorded_date: str(input.recorded_date) || null })
      .select("id")
      .single();
    if (error) return `経費の登録に失敗しました: ${error.message}`;
    await auditLog(supabase, {
      action: "operating_cost_create",
      entityType: "operating_cost",
      entityId: data.id,
      summary: `${ym} の経費「${category}」${yen(amount)} を登録（AIアシスタント）`,
    }).catch(() => {});
    return `経費を登録しました: ${ym} | ${category} | ${yen(amount)}（id: ${data.id}）`;
  },

  async update_cost(input) {
    const id = str(input.id);
    if (!id) return "経費のidを指定してください（list_costs で確認できます）。";
    const patch: Record<string, unknown> = {};
    if (input.year_month != null) {
      const ym = str(input.year_month);
      if (!/^\d{4}-\d{2}$/.test(ym)) return "年月は YYYY-MM で指定してください。";
      patch.year_month = ym;
    }
    if (input.category != null) patch.category = str(input.category) || "その他";
    if (input.amount != null) {
      const amount = Number(input.amount);
      if (!Number.isInteger(amount) || amount < 0) return "金額は0以上の整数で指定してください。";
      patch.amount = amount;
    }
    if (input.description != null) patch.description = str(input.description) || null;
    if (input.recorded_date != null) patch.recorded_date = str(input.recorded_date) || null;
    if (Object.keys(patch).length === 0) return "変更内容がありません。";

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("operating_costs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("year_month, category, amount")
      .maybeSingle();
    if (error) return `更新に失敗しました: ${error.message}`;
    if (!data) return `id ${id} の経費は見つかりません。`;
    await auditLog(supabase, {
      action: "operating_cost_update",
      entityType: "operating_cost",
      entityId: id,
      summary: `経費を更新（AIアシスタント）`,
      metadata: patch,
    }).catch(() => {});
    return `経費を更新しました: ${data.year_month} | ${data.category} | ${yen(data.amount)}`;
  },

  async delete_cost(input) {
    const id = str(input.id);
    if (!id) return "経費のidを指定してください（list_costs で確認できます）。";
    const supabase = createAdminClient();
    const { data } = await supabase.from("operating_costs").select("year_month, category, amount, description").eq("id", id).maybeSingle();
    if (!data) return `id ${id} の経費は見つかりません。`;
    const label = `${data.year_month} | ${data.category} | ${yen(data.amount)}${data.description ? ` | ${data.description}` : ""}`;

    if (input.confirm !== true) {
      return `【未削除・確認待ち】次の経費を削除します（取り消せません）。\n${label}\nユーザーの同意を得てから confirm=true で再度呼び出してください。`;
    }
    const { error } = await supabase.from("operating_costs").delete().eq("id", id);
    if (error) return `削除に失敗しました: ${error.message}`;
    await auditLog(supabase, {
      action: "operating_cost_delete",
      entityType: "operating_cost",
      entityId: id,
      summary: `経費「${label}」を削除（AIアシスタント）`,
    }).catch(() => {});
    return `経費を削除しました: ${label}`;
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
  {
    name: "get_analytics",
    description: "売上・経費・粗利益・予約数・キャンセル率・稼働率の集計を取得する。管理画面の分析ページと同じ計算（チェックイン日ベース、確定売上は支払済のみ）。month を省略すると年間。",
    input_schema: { type: "object", properties: { year: { type: "string", description: "YYYY（省略時は今年）" }, month: { type: "string", description: "1〜12（省略時は年間）" } }, required: [] },
  },
  { name: "list_costs", description: "登録済みの経費を新しい順に最大50件取得する。修正・削除に使う id も分かる。", input_schema: { type: "object", properties: { year_month: { type: "string", description: "YYYY-MM または YYYY（省略時は全期間）" } }, required: [] } },
  {
    name: "add_cost",
    description: "経費（コスト）を登録する。カテゴリ例: 家賃・電気代・ガス代・水道代・Wi-Fi通信費・清掃費・消耗品・広告費・その他。登録後に内容を報告すること。",
    input_schema: { type: "object", properties: { year_month: { type: "string", description: "計上する年月 YYYY-MM" }, category: { type: "string" }, amount: { type: "number", description: "円（整数）" }, description: { type: "string" }, recorded_date: { type: "string", description: "支払日 YYYY-MM-DD（任意）" } }, required: ["year_month", "amount"] },
  },
  {
    name: "update_cost",
    description: "登録済みの経費を修正する。idは list_costs で確認する。",
    input_schema: { type: "object", properties: { id: { type: "string" }, year_month: { type: "string" }, category: { type: "string" }, amount: { type: "number" }, description: { type: "string" }, recorded_date: { type: "string" } }, required: ["id"] },
  },
  {
    name: "delete_cost",
    description: "経費を削除する（取り消せない）。confirm なしで呼ぶと対象のプレビューだけ返し、削除しない。ユーザーの同意を得てから confirm=true で再度呼ぶこと。",
    input_schema: { type: "object", properties: { id: { type: "string" }, confirm: { type: "boolean", description: "ユーザーが削除に同意した場合のみ true" } }, required: ["id"] },
  },
];
