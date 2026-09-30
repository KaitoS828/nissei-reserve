import { toolImpls, TOOLS } from "./slack-agent";

// 新規利用できる中で最も安い Flash-Lite（入力$0.25 / 出力$1.50 per 1M tokens）。OpenAI互換エンドポイントを使う。
const MODEL = "gemini-3.1-flash-lite";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 全ツール定義と全ルールを毎回送ると1リクエストで約4,000トークンになりコストも嵩むので、「常に要る基本ツール」と、話題に応じて足すグループに分けて必要な分だけ送る。
const CORE_TOOLS = ["check_availability", "list_reservations", "get_reservation", "create_reservation", "update_reservation"];

const GROUPS: { tools: string[]; keywords: RegExp; rules: string }[] = [
  {
    tools: ["quote_cancellation", "cancel_reservation"],
    keywords: /キャンセル|返金|取り消|取消/,
    rules: "- 【確認ステップ】キャンセルはいきなり実行しない。対象予約を特定し、quote_cancellation で返金額を試算して提示し、「実行してよろしいですか？」と確認する。明確な同意があった場合に限り cancel_reservation を呼ぶ。",
  },
  {
    tools: ["block_dates", "unblock_dates"],
    keywords: /休業|予約不可|ブロック|閉める|閉館|解除|空け/,
    rules: "- 「9月10日から12日まで予約不可」のような期間は start=2026-09-10, end=2026-09-12 のように両端を含めて指定する。休業日の設定/解除は取り消しが容易なため、日付が明確なら確認なしで実行してよい。",
  },
  {
    tools: ["edit_reservation"],
    keywords: /編集|修正|直し|訂正|変更|金額|支払|備考|メモ|名前|氏名|電話|メール|経路|領収/,
    rules: "- 予約情報の編集（edit_reservation）は内容が明確なら確認なしで実行し、何を変えたかを一言で報告する。日程・人数・ステータスの変更は update_reservation を使う。",
  },
  {
    tools: ["send_email", "create_payment_link"],
    keywords: /メール|連絡|送信|送って|決済|リンク|支払/,
    rules: "- 【メール送信】お客様へのメール（send_email）は必ず先に confirm なしで呼び、返ってきた宛先・件名・本文をそのまま提示して同意を得る。同意後にだけ confirm=true で再度呼ぶ。\n- 決済リンク（create_payment_link）は発行前に金額を確認する。発行してもお客様へは自動送信されない。",
  },
  {
    tools: ["list_plans", "update_plan"],
    keywords: /プラン|料金|値段|価格|値上|値下|公開|非公開/,
    rules: "- 【プラン料金の変更】update_plan は、変更前後のプレビューを提示して同意を得てから confirm=true で実行する。公開サイトの料金に即時反映される。",
  },
  {
    tools: ["list_ical_sources", "sync_ical", "add_ical_source", "update_ical_source"],
    keywords: /iCal|ical|カレンダー|同期|連携|取込|取り込/i,
    rules: "- iCal連携先の追加/変更は、内容が明確なら確認なしで実行してよい。実行後は何を変えたかを一言で報告する。",
  },
  {
    tools: ["get_analytics", "list_costs", "add_cost", "update_cost", "delete_cost"],
    keywords: /売上|集計|経費|コスト|費用|利益|稼働|分析|清掃|家賃|電気|ガス|水道|Wi-?Fi|手数料|ローン/i,
    rules: "- 経費の登録・修正（add_cost / update_cost）は内容が明確なら確認なしで実行し、実行後に内容を報告する。削除（delete_cost）は先に confirm なしで呼んで対象を提示し、同意を得てから confirm=true で実行する。集計は get_analytics の結果をそのまま伝え、憶測で数字を補わない。",
  },
];

// OTAの予約通知が貼られたときだけ付けるルール（長いので常時は送らない）
const OTA_PASTE_PATTERN = /予約ID|宿泊期間|予約受付日|Airbnb|Booking|楽天|Vacation/i;
const OTA_PASTE_RULES = `- 【OTA予約の貼り付け】予約通知テキストが貼られたら、内容を読み取って create_reservation で登録する。
  ・氏名は姓と名に分ける。メール・電話は貼り付けのものをそのまま使う。
  ・channel は OTA 名から選ぶ。external_id には予約ID（例 V056-KSJY4TOC）を入れる。宿泊期間の終了日がチェックアウト日。
  ・plan には「素泊まり」「サウナ付き」「日帰り」のような短いキーワードだけを渡す（OTAのプラン名全文は渡さない）。素泊まり/カジュアル→素泊まり、サウナ→サウナ付き。
  ・事前カード決済などOTA側で決済済みなら payment_status=paid、現地払いなら unpaid。
  ・amount は宿の売上として「宿泊料金合計＋清掃料金」を基本とし、OTAの手配手数料などは含めない。内訳（OTAの合計金額・手数料・部屋タイプ名・キャンセルポリシー・予約受付日）は note に残す。
  ・登録は2段階。まず confirm なしで create_reservation を呼ぶとプレビューが返る（この時点では未登録）。読み取り結果と金額の解釈をユーザーに見せて同意を得てから、同じ内容に confirm=true を付けて再度呼ぶ。
  ・貼り付けに宿泊人数が無い場合は、人数を推測せず、先にユーザーへ質問する（num_guests を仮の値で渡さない）。
  ・external_id が登録済みなら二重登録されない。その場合は既存の予約番号を伝える。`;

const BASE_SYSTEM = () => `あなたは一棟貸ゲストハウス日靜の予約システムに組み込まれた運用アシスタントです。管理画面からオーナーの依頼を受け、ツールで予約・料金・経費などを操作します。

- 本日の日付は ${todayStr()} です。「今週」「来月」などはこの日付を基準に YYYY-MM-DD へ変換する。年が省略された場合は直近の未来の日付とする。
- 簡潔に、日本語で返答する。予約番号は R-YYYYMMDD-XXXX 形式。
- 予約変更など取り消せない操作は、対象と影響を示して同意を得てから実行する。同意が曖昧なら再確認する。
- 返金額や料金はツールが計算する。憶測で金額を答えない。`;

// 最新のユーザー発言と、直近の会話で使われたツールから、今回送るツールとルールを決める。
function selectContext(userText: string, history: ChatHistory) {
  const recent = history.slice(-8);
  const usedTools = new Set(
    recent.flatMap((m) => (m.role === "assistant" && m.tool_calls ? m.tool_calls.map((c) => c.function.name) : [])),
  );
  const recentUserText = [
    ...recent.filter((m) => m.role === "user").map((m) => m.content as string),
    userText,
  ].join("\n");

  const toolNames = new Set(CORE_TOOLS);
  const rules: string[] = [];
  for (const g of GROUPS) {
    // 前の会話でそのグループのツールを使っていれば、「4名です」のような短い返事でも維持する
    if (g.keywords.test(recentUserText) || g.tools.some((t) => usedTools.has(t))) {
      g.tools.forEach((t) => toolNames.add(t));
      rules.push(g.rules);
    }
  }
  if (OTA_PASTE_PATTERN.test(userText) || OTA_PASTE_PATTERN.test(recentUserText)) rules.push(OTA_PASTE_RULES);

  const tools = TOOLS.filter((t) => toolNames.has(t.name)).map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
  return { tools, system: [BASE_SYSTEM(), ...rules].join("\n") };
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatHistory = ChatMessage[];
export type AssistantTurn = { reply: string; history: ChatHistory };

async function callLLM(apiKey: string, messages: ChatMessage[], tools: unknown[]) {
  const send = () =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
    });

  let res = await send();
  // 上限(429)は数秒待てば通ることが多いので、待ち時間が短いときだけ1回やり直す。
  if (res.status === 429) {
    const text = await res.clone().text();
    const m = text.match(/(?:try again|retry) in ([\d.]+)(ms|s)/i);
    const waitMs = m ? Number(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000) : Infinity;
    if (waitMs <= 8000) {
      await new Promise((r) => setTimeout(r, waitMs + 300));
      res = await send();
    }
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as {
    choices?: { message?: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] } }[];
  };
}

/** 1メッセージを処理する。history は過去の会話（確認ステップの文脈保持用）。 */
export async function runAssistant(
  userText: string,
  history: ChatHistory = [],
): Promise<AssistantTurn> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: "（GEMINI_API_KEY が未設定のため、AIアシスタントは無効です）", history };
  }

  const { tools, system } = selectContext(userText, history);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: userText },
  ];

  for (let step = 0; step < 8; step++) {
    const data = await callLLM(apiKey, messages, tools);
    const message = data.choices?.[0]?.message;
    if (!message) {
      return { reply: "（応答がありませんでした）", history: messages.slice(1) };
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      const text = (message.content ?? "").trim();
      return { reply: text || "（応答がありませんでした）", history: messages.slice(1) };
    }

    for (const call of calls) {
      let out: string;
      try {
        const impl = toolImpls[call.function.name];
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        out = impl ? await impl(args) : `不明なツール: ${call.function.name}`;
      } catch (e) {
        out = `ツール実行エラー: ${e instanceof Error ? e.message : String(e)}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: out });
    }
  }

  return {
    reply: "処理が長くなりすぎたため中断しました。もう一度具体的に指示してください。",
    history: messages.slice(1),
  };
}
