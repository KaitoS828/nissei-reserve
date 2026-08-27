import { toolImpls, TOOLS } from "./slack-agent";

const MODEL = "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// TOOLS の input_schema は既に標準JSON Schema（type小文字）なので、Groq/OpenAI形式の
// tools にはそのまま parameters として渡せる。
const GROQ_TOOLS = TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

const SYSTEM = `あなたは一棟貸ゲストハウス日靜の予約システムに組み込まれた運用アシスタントです。管理画面からオーナーの依頼を受け、ツールを使って予約状況の確認・予約の変更/キャンセル・休業日設定などを行います。

- 本日の日付は ${todayStr()} です。「今週」「来月」などの相対的な表現はこの日付を基準に YYYY-MM-DD へ変換してください。
- 年が省略された場合（例:「9月10日」）は、直近の未来の日付として解釈してください。
- 「9月10日から12日まで予約不可」のような期間指定は start=2026-09-10, end=2026-09-12 のように両端を含めて指定します。
- 簡潔に、日本語で返答してください。予約番号は R-YYYYMMDD-XXXX 形式です。
- 【重要・確認ステップ】キャンセル・予約変更など「取り消せない操作」は、いきなり実行しないこと。まず対象予約を特定し、影響を提示する。キャンセルの場合は必ず quote_cancellation で返金額を試算して提示し、「実行してよろしいですか？」と確認する。ユーザーが明確に同意した場合に限り実行ツールを呼ぶ。
- 休業日の設定/解除（block_dates / unblock_dates）は取り消しが容易なため、日付が明確なら確認なしで実行してよい。日付が曖昧な場合のみ確認する。
- 返金額やポリシーはツールが自動計算します。憶測で金額を答えないこと。`;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type GroqHistory = ChatMessage[];
export type AssistantTurn = { reply: string; history: GroqHistory };

async function callGroq(apiKey: string, messages: ChatMessage[]) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: GROQ_TOOLS,
      tool_choice: "auto",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API エラー (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as {
    choices?: { message?: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] } }[];
  };
}

/** 1メッセージを処理する。history は過去の会話（確認ステップの文脈保持用）。 */
export async function runAssistant(
  userText: string,
  history: GroqHistory = [],
): Promise<AssistantTurn> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { reply: "（GROQ_API_KEY が未設定のため、AIアシスタントは無効です）", history };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: userText },
  ];

  for (let step = 0; step < 8; step++) {
    const data = await callGroq(apiKey, messages);
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
