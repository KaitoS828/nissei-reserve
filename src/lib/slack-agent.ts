import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";
import { getDefaultFacilityId } from "./facility";
import { getTypeAvailability, canBook, generateReservationCode } from "./reservations";
import { eachNight } from "./availability";
import { calcPrice, nightlyRateForGuests, type Discount, type GuestPrices } from "./pricing";
import { computeRefund } from "./cancel";
import { getStripe } from "./stripe";
import { gcalCreateEvent, gcalDeleteEvent } from "./gcal";
import { revokeDoorPin } from "./smart-lock";

// コスト重視で Sonnet（現行は 4.6。「4.7」は存在しないため 4.6 を使用）
const MODEL = "claude-sonnet-4-6";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function activeRoomTypeId(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("room_types")
    .select("id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const RESV_SELECT =
  "code, check_in, check_out, nights, num_guests, amount, status, payment_status, room_type_id, customers(last_name, first_name, email, phone), plans(name)";

// ---- ツール実装（Slack / サイト内アシスタントで共用）----
export const toolImpls: Record<string, (input: Record<string, unknown>) => Promise<string>> = {
  async check_availability(input) {
    const from = String(input.from);
    const to = String(input.to);
    const rt = await activeRoomTypeId();
    if (!rt) return "客室タイプが未登録です。";
    const avail = await getTypeAvailability(rt, from, to);
    const lines = eachNight(from, to).map(
      (n) => `${n}: ${(avail[n] ?? 0) > 0 ? "空室あり" : "満室"}`,
    );
    return `空室状況（${from}〜${to}）\n${lines.join("\n")}`;
  },

  async list_reservations(input) {
    const scope = String(input.scope ?? "upcoming");
    const query = input.query ? String(input.query) : null;
    const supabase = createAdminClient();
    const today = todayStr();
    let q = supabase.from("reservations").select(RESV_SELECT);
    if (scope === "today") {
      q = q.or(`check_in.eq.${today},check_out.eq.${today}`);
    } else if (scope === "upcoming") {
      q = q.gte("check_in", today).in("status", ["pending", "confirmed"]);
    }
    q = q.order("check_in").limit(30);
    const { data } = await q;
    let rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    if (query) {
      const t = query.toLowerCase();
      rows = rows.filter((r) => {
        const c = r.customers as { last_name?: string; first_name?: string; email?: string } | null;
        const name = `${c?.last_name ?? ""}${c?.first_name ?? ""}`.toLowerCase();
        return String(r.code).toLowerCase().includes(t) || name.includes(t) || (c?.email ?? "").toLowerCase().includes(t);
      });
    }
    if (rows.length === 0) return "該当する予約はありません。";
    return rows.map((r) => formatResv(r)).join("\n");
  },

  async get_reservation(input) {
    const code = String(input.code);
    const supabase = createAdminClient();
    const { data } = await supabase.from("reservations").select(RESV_SELECT).eq("code", code).maybeSingle();
    if (!data) return `予約番号 ${code} は見つかりません。`;
    return formatResv(data as unknown as Record<string, unknown>);
  },

  async quote_cancellation(input) {
    const code = String(input.code);
    const supabase = createAdminClient();
    const { data: resv } = await supabase
      .from("reservations")
      .select("code, check_in, amount, status")
      .eq("code", code)
      .maybeSingle();
    if (!resv) return `予約番号 ${code} は見つかりません。`;
    if (resv.status === "cancelled") return `予約 ${code} はすでにキャンセル済みです。`;
    const { data: facility } = await supabase.from("facility").select("cancel_policy").limit(1).single();
    const { refundAmount, feeAmount, chargeRate, daysBefore } = computeRefund(
      resv.amount as number,
      resv.check_in as string,
      (facility?.cancel_policy ?? null) as Record<string, number> | null,
    );
    return `【試算】予約 ${code} を今キャンセルした場合：チェックインまで${daysBefore}日 / キャンセル料 ¥${feeAmount.toLocaleString()}（${Math.round(chargeRate * 100)}%）/ 返金 ¥${refundAmount.toLocaleString()}。※まだ実行していません。`;
  },

  async cancel_reservation(input) {
    const code = String(input.code);
    const reason = input.reason ? String(input.reason) : "";
    const supabase = createAdminClient();
    const { data: resv } = await supabase
      .from("reservations")
      .select("id, check_in, amount, status, payment_status, gcal_event_id")
      .eq("code", code)
      .maybeSingle();
    if (!resv) return `予約番号 ${code} は見つかりません。`;
    if (resv.status === "cancelled") return `予約 ${code} はすでにキャンセル済みです。`;

    const { data: facility } = await supabase.from("facility").select("cancel_policy").limit(1).single();
    const { refundAmount } = computeRefund(
      resv.amount as number,
      resv.check_in as string,
      (facility?.cancel_policy ?? null) as Record<string, number> | null,
    );
    // Stripe返金
    if (refundAmount > 0) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, stripe_payment_intent_id")
        .eq("reservation_id", resv.id)
        .maybeSingle();
      if (payment?.stripe_payment_intent_id) {
        try {
          await getStripe().refunds.create({ payment_intent: payment.stripe_payment_intent_id, amount: refundAmount });
          await supabase.from("payments").update({ refunded_amount: refundAmount, status: refundAmount >= (resv.amount as number) ? "refunded" : "partially_refunded" }).eq("id", payment.id);
        } catch {
          return "Stripe返金に失敗しました。手動で確認してください。";
        }
      }
    }
    const payStatus = refundAmount >= (resv.amount as number) ? "refunded" : refundAmount > 0 ? "partially_refunded" : (resv.payment_status as string);
    await supabase.from("reservations").update({ status: "cancelled", payment_status: payStatus, cancel_category: "オーナー操作", cancel_reason: reason || null, cancelled_at: new Date().toISOString() }).eq("id", resv.id);
    if (resv.gcal_event_id) await gcalDeleteEvent(resv.gcal_event_id as string).catch(() => {});
    await revokeDoorPin(resv.id as string).catch(() => {});
    return `予約 ${code} をキャンセルしました。返金額: ¥${refundAmount.toLocaleString()}`;
  },

  async block_dates(input) {
    const start = String(input.start);
    const end = String(input.end ?? start);
    const reason = input.reason ? String(input.reason) : "休業";
    const supabase = createAdminClient();
    const facilityId = await getDefaultFacilityId(supabase);
    const { error } = await supabase
      .from("blocked_dates")
      .insert({ facility_id: facilityId, start_date: start, end_date: end, reason });
    if (error) return `休業日の設定に失敗しました: ${error.message}`;
    return `${start}〜${end} を予約不可（${reason}）に設定しました。公開カレンダーに反映されます。`;
  },

  async unblock_dates(input) {
    const start = String(input.start);
    const supabase = createAdminClient();
    await supabase.from("blocked_dates").delete().eq("start_date", start);
    return `${start} 開始の休業日設定を解除しました。`;
  },

  async create_reservation(input) {
    const last_name = String(input.last_name ?? "").trim();
    const first_name = String(input.first_name ?? "").trim();
    const email = input.email ? String(input.email).trim() : null;
    const phone = input.phone ? String(input.phone).trim() : null;
    const check_in = String(input.check_in);
    const check_out = String(input.check_out);
    const num_guests = Number(input.num_guests ?? 1);
    const plan_query = input.plan ? String(input.plan) : null;
    const amount_override = input.amount != null ? Number(input.amount) : null;
    const payment_status = input.payment_status ? String(input.payment_status) : "unpaid";
    const note = input.note ? String(input.note) : null;

    if (!last_name || !first_name) return "氏名（姓・名）は必須です。";

    const supabase = createAdminClient();

    type PlanRow = { id: string; name: string; discounts: unknown; plan_prices: Array<{ price_per_night: number; guest_prices: GuestPrices; room_type_id: string }> };
    let planData: PlanRow | null = null;
    if (plan_query) {
      const { data } = await supabase
        .from("plans")
        .select("id, name, discounts, plan_prices(price_per_night, guest_prices, room_type_id)")
        .ilike("name", `%${plan_query}%`)
        .limit(1)
        .maybeSingle();
      planData = data as PlanRow | null;
    }
    if (!planData) {
      const { data } = await supabase
        .from("plans")
        .select("id, name, discounts, plan_prices(price_per_night, guest_prices, room_type_id)")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      planData = data as PlanRow | null;
    }
    if (!planData) return "有効なプランが見つかりません。";

    const pp = (planData.plan_prices ?? [])[0];
    if (!pp) return `プラン「${planData.name}」に料金が設定されていません。`;
    const roomTypeId = pp.room_type_id;

    const ok = await canBook(roomTypeId, check_in, check_out);
    if (!ok) return `${check_in}〜${check_out} は満室のため予約できません。`;

    const nightly = nightlyRateForGuests(num_guests, pp.guest_prices, pp.price_per_night);
    const price = calcPrice(check_in, check_out, nightly, (planData.discounts ?? []) as Discount[]);
    const amount = amount_override ?? price.total;

    const facilityId = await getDefaultFacilityId(supabase);
    const custFields = { last_name, first_name, facility_id: facilityId, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
    let customerId: string;
    if (email) {
      const { data: existing } = await supabase.from("customers").select("id").eq("email", email).limit(1).maybeSingle();
      if (existing) {
        customerId = existing.id;
        await supabase.from("customers").update(custFields).eq("id", customerId);
      } else {
        const { data: created, error } = await supabase.from("customers").insert(custFields).select("id").single();
        if (error || !created) return `顧客情報の保存に失敗しました: ${error?.message}`;
        customerId = created.id;
      }
    } else {
      const { data: created, error } = await supabase.from("customers").insert(custFields).select("id").single();
      if (error || !created) return `顧客情報の保存に失敗しました: ${error?.message}`;
      customerId = created.id;
    }

    const code = generateReservationCode(check_in);
    const { data: resv, error: resErr } = await supabase
      .from("reservations")
      .insert({
        // nights は DB の生成列なので渡さない（渡すと insert が拒否される）
        code, customer_id: customerId, plan_id: planData.id, room_type_id: roomTypeId,
        facility_id: facilityId,
        check_in, check_out, num_guests, num_children: 0,
        amount, status: "confirmed", payment_status, source: "admin",
        ...(note ? { note } : {}),
        lookup_token: randomUUID(),
      })
      .select("id, code")
      .single();
    if (resErr || !resv) return `予約の作成に失敗しました: ${resErr?.message}`;

    const gcalEventId = await gcalCreateEvent({
      code: resv.code,
      customer: `${last_name} ${first_name}`,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      plan: planData.name,
      check_in, check_out,
      guests: num_guests,
      amount,
    });
    if (gcalEventId) {
      await supabase.from("reservations").update({ gcal_event_id: gcalEventId }).eq("id", resv.id);
    }

    return `✅ 予約を登録しました\n・予約番号: ${resv.code}\n・${last_name} ${first_name}様 / ${check_in}〜${check_out}（${price.nights}泊 / ${num_guests}名）\n・プラン: ${planData.name} / ¥${amount.toLocaleString()}（${payment_status === "paid" ? "支払済" : "未払い"}）`;
  },

  async update_reservation(input) {
    const code = String(input.code);
    const supabase = createAdminClient();
    const { data: resv } = await supabase.from("reservations").select("id, room_type_id, check_in, check_out").eq("code", code).maybeSingle();
    if (!resv) return `予約番号 ${code} は見つかりません。`;
    const patch: Record<string, unknown> = {};
    const newIn = input.check_in ? String(input.check_in) : (resv.check_in as string);
    const newOut = input.check_out ? String(input.check_out) : (resv.check_out as string);
    if (input.check_in || input.check_out) {
      if (eachNight(newIn, newOut).length < 1) return "チェックアウトはチェックインの翌日以降にしてください。";
      const ok = await canBook(resv.room_type_id as string, newIn, newOut, { excludeReservationId: resv.id as string });
      if (!ok) return `${newIn}〜${newOut} は空きがないため変更できません。`;
      patch.check_in = newIn;
      patch.check_out = newOut;
    }
    if (input.num_guests != null) patch.num_guests = Number(input.num_guests);
    if (input.status) patch.status = String(input.status);
    if (Object.keys(patch).length === 0) return "変更内容がありません。";
    await supabase.from("reservations").update(patch).eq("id", resv.id);
    return `予約 ${code} を更新しました（${Object.keys(patch).join(", ")}）。`;
  },
};

function formatResv(r: Record<string, unknown>): string {
  const c = r.customers as { last_name?: string; first_name?: string; phone?: string } | null;
  const p = r.plans as { name?: string } | null;
  const name = [c?.last_name, c?.first_name].filter(Boolean).join(" ") || "（無名）";
  return `・${r.code} | ${name} | ${r.check_in}〜${r.check_out}（${r.nights}泊/${r.num_guests}名） | ${p?.name ?? "—"} | ¥${Number(r.amount).toLocaleString()} | ${r.status}`;
}

export const TOOLS: Anthropic.Tool[] = [
  { name: "check_availability", description: "指定期間の空室状況を確認する。", input_schema: { type: "object", properties: { from: { type: "string", description: "チェックイン日 YYYY-MM-DD" }, to: { type: "string", description: "チェックアウト日 YYYY-MM-DD" } }, required: ["from", "to"] } },
  { name: "list_reservations", description: "予約の一覧を取得する。scope=today(本日), upcoming(今後), all(直近)。queryで氏名・予約番号・メールで絞り込み可。", input_schema: { type: "object", properties: { scope: { type: "string", enum: ["today", "upcoming", "all"] }, query: { type: "string" } }, required: [] } },
  { name: "get_reservation", description: "予約番号で1件の予約詳細を取得する。", input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } },
  { name: "quote_cancellation", description: "キャンセルした場合の返金額・キャンセル料を試算する（DBは変更しない）。キャンセルを実行する前に必ずこれで金額を提示し、確認を取ること。", input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } },
  { name: "cancel_reservation", description: "予約をキャンセルする（取り消し不可）。キャンセルポリシーに従いStripe返金も行う。実行前にユーザーの明確な同意が必要。理由を添える。", input_schema: { type: "object", properties: { code: { type: "string" }, reason: { type: "string" } }, required: ["code"] } },
  { name: "block_dates", description: "休業日（予約不可日）を設定する。公開カレンダーがグレーになる。", input_schema: { type: "object", properties: { start: { type: "string", description: "開始日 YYYY-MM-DD" }, end: { type: "string", description: "終了日 YYYY-MM-DD（省略時は1日）" }, reason: { type: "string" } }, required: ["start"] } },
  { name: "unblock_dates", description: "指定開始日の休業日設定を解除する。", input_schema: { type: "object", properties: { start: { type: "string" } }, required: ["start"] } },
  { name: "create_reservation", description: "新規予約を登録する。空室確認・料金計算・顧客登録・Googleカレンダー反映まで行う。電話・対面・Airbnb等の外部チャネル経由の予約を手動登録する際に使う。", input_schema: { type: "object", properties: { last_name: { type: "string", description: "姓" }, first_name: { type: "string", description: "名" }, email: { type: "string", description: "メールアドレス（任意）" }, phone: { type: "string", description: "電話番号（任意）" }, check_in: { type: "string", description: "チェックイン日 YYYY-MM-DD" }, check_out: { type: "string", description: "チェックアウト日 YYYY-MM-DD" }, num_guests: { type: "number", description: "人数" }, plan: { type: "string", description: "プラン名（部分一致。省略時はデフォルトプラン）" }, amount: { type: "number", description: "金額（省略時は自動計算）" }, payment_status: { type: "string", enum: ["unpaid", "paid"], description: "支払状況（デフォルト: unpaid）" }, note: { type: "string", description: "備考・特記事項" } }, required: ["last_name", "first_name", "check_in", "check_out", "num_guests"] } },
  { name: "update_reservation", description: "予約の日程・人数・ステータスを変更する。日程変更時は空室を確認する。", input_schema: { type: "object", properties: { code: { type: "string" }, check_in: { type: "string" }, check_out: { type: "string" }, num_guests: { type: "number" }, status: { type: "string", enum: ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] } }, required: ["code"] } },
];

const SYSTEM = `あなたは一棟貸し宿「日靜」の予約システムの運用アシスタントです。Slackでオーナーからの依頼を受け、ツールを使って予約状況の確認・予約の変更/キャンセル・休業日設定などを行います。

- 本日の日付は ${todayStr()} です（依頼時に最新化されます）。
- 簡潔に、日本語で、Slack向けに読みやすく返答してください。
- 予約番号は R-YYYYMMDD-XXXX 形式です。
- 【重要・確認ステップ】キャンセル・休業日設定/解除・予約変更など「取り消せない操作」は、いきなり実行しないこと。まず対象予約を特定し（必要なら get_reservation / list_reservations）、影響を提示する。キャンセルの場合は必ず quote_cancellation で返金額・キャンセル料を試算して提示し、「実行してよろしいですか？」と確認する。ユーザーが同じスレッドで明確に同意（「はい」「OK」「お願いします」等）した場合に限り、対応する実行ツール（cancel_reservation / block_dates / unblock_dates / update_reservation）を呼ぶ。会話はスレッド単位で文脈が保持されるので、前のメッセージの対象を引き継いでよい。
- 同意が曖昧な場合（「どうしよう」等）は実行せず、再確認する。
- 返金額やポリシーはツールが自動計算します。憶測で金額を答えないこと。`;

export type AgentTurn = { reply: string; messages: Anthropic.MessageParam[] };

// Slackからの1メッセージを処理。history はスレッドの過去会話（確認ステップの文脈保持用）。
export async function runAgent(userText: string, history: Anthropic.MessageParam[] = []): Promise<AgentTurn> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "（ANTHROPIC_API_KEY が未設定のため、AIエージェントは無効です）", messages: history };
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userText }];

  for (let step = 0; step < 8; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { reply: text || "（応答がありませんでした）", messages };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type === "tool_use") {
        let out: string;
        try {
          const impl = toolImpls[block.name];
          out = impl ? await impl(block.input as Record<string, unknown>) : `不明なツール: ${block.name}`;
        } catch (e) {
          out = `ツール実行エラー: ${e instanceof Error ? e.message : String(e)}`;
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }
  return { reply: "処理が長くなりすぎたため中断しました。もう一度具体的に指示してください。", messages };
}
