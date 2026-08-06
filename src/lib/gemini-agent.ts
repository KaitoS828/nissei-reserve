import { toolImpls, TOOLS } from "./slack-agent";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Anthropic の input_schema（JSON Schema）を Gemini の parameters 形式へ。
// type を大文字化し、Gemini が受け付けないキーを落とす。
type JsonSchema = {
  type?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
};

function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  if (schema.type) out.type = schema.type.toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  if (schema.required && schema.required.length > 0) out.required = schema.required;
  return out;
}

const FUNCTION_DECLARATIONS = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: toGeminiSchema(t.input_schema as JsonSchema),
}));

const SYSTEM = `あなたは一棟貸し宿「日靜」の予約システムに組み込まれた運用アシスタントです。管理画面からオーナーの依頼を受け、ツールを使って予約状況の確認・予約の変更/キャンセル・休業日設定などを行います。

- 本日の日付は ${todayStr()} です。「今週」「来月」などの相対的な表現はこの日付を基準に YYYY-MM-DD へ変換してください。
- 年が省略された場合（例:「9月10日」）は、直近の未来の日付として解釈してください。
- 「9月10日から12日まで予約不可」のような期間指定は start=2026-09-10, end=2026-09-12 のように両端を含めて指定します。
- 簡潔に、日本語で返答してください。予約番号は R-YYYYMMDD-XXXX 形式です。
- 【重要・確認ステップ】キャンセル・予約変更など「取り消せない操作」は、いきなり実行しないこと。まず対象予約を特定し、影響を提示する。キャンセルの場合は必ず quote_cancellation で返金額を試算して提示し、「実行してよろしいですか？」と確認する。ユーザーが明確に同意した場合に限り実行ツールを呼ぶ。
- 休業日の設定/解除（block_dates / unblock_dates）は取り消しが容易なため、日付が明確なら確認なしで実行してよい。日付が曖昧な場合のみ確認する。
- 返金額やポリシーはツールが自動計算します。憶測で金額を答えないこと。`;

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type AssistantTurn = { reply: string; history: GeminiContent[] };

async function callGemini(apiKey: string, contents: GeminiContent[]) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
}

/** 1メッセージを処理する。history は過去の会話（確認ステップの文脈保持用）。 */
export async function runAssistant(
  userText: string,
  history: GeminiContent[] = [],
): Promise<AssistantTurn> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: "（GEMINI_API_KEY が未設定のため、AIアシスタントは無効です）", history };
  }

  const contents: GeminiContent[] = [
    ...history,
    { role: "user", parts: [{ text: userText }] },
  ];

  for (let step = 0; step < 8; step++) {
    const data = await callGemini(apiKey, contents);
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    if (parts.length === 0) {
      return { reply: "（応答がありませんでした）", history: contents };
    }

    contents.push({ role: "model", parts });

    const calls = parts.filter(
      (p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p,
    );

    if (calls.length === 0) {
      const text = parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n")
        .trim();
      return { reply: text || "（応答がありませんでした）", history: contents };
    }

    const responses: GeminiPart[] = [];
    for (const { functionCall } of calls) {
      let out: string;
      try {
        const impl = toolImpls[functionCall.name];
        out = impl
          ? await impl(functionCall.args ?? {})
          : `不明なツール: ${functionCall.name}`;
      } catch (e) {
        out = `ツール実行エラー: ${e instanceof Error ? e.message : String(e)}`;
      }
      responses.push({
        functionResponse: { name: functionCall.name, response: { result: out } },
      });
    }
    contents.push({ role: "user", parts: responses });
  }

  return {
    reply: "処理が長くなりすぎたため中断しました。もう一度具体的に指示してください。",
    history: contents,
  };
}
