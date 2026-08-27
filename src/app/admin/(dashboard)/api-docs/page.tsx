import { headers } from "next/headers";
import { originFromHeaders } from "@/lib/booking-guide-server";
import { TOOLS } from "@/lib/slack-agent";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";
const mono =
  "break-all rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800";
const pre = "overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100";

const REST_ENDPOINTS = [
  { method: "GET", path: "/api/v1/availability", auth: "不要", desc: "指定期間の空室状況を確認" },
  { method: "GET", path: "/api/v1/plans", auth: "不要", desc: "有効な宿泊プラン一覧" },
  { method: "GET", path: "/api/v1/reservations", auth: "必須", desc: "予約一覧（scope/queryで絞り込み）" },
  { method: "GET", path: "/api/v1/reservations/:code", auth: "必須", desc: "予約1件の詳細" },
  { method: "POST", path: "/api/v1/reservations", auth: "必須", desc: "新規予約を登録" },
  { method: "PATCH", path: "/api/v1/reservations/:code", auth: "必須", desc: "日程・人数・ステータス変更" },
  { method: "POST", path: "/api/v1/reservations/:code/cancel", auth: "必須", desc: "キャンセル実行（?quote=1で試算のみ）" },
];

export default async function ApiDocsPage() {
  const h = await headers();
  const origin = originFromHeaders(h);
  const apiKey = process.env.EXTERNAL_API_KEY ?? null;

  const claudeCmd = `claude mcp add --transport http nissei ${origin}/api/mcp \\\n  --header "Authorization: Bearer ${apiKey ?? "<EXTERNAL_API_KEY>"}"`;

  const curlCmd = `curl -X POST ${origin}/api/mcp \\\n  -H "Authorization: Bearer ${apiKey ?? "<EXTERNAL_API_KEY>"}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">API / MCP 連携</h1>
        <p className="mt-1 text-sm text-gray-500">
          外部ツール・AIエージェント（Claude Code等）から空室確認や予約操作を行うための連携情報です。
          詳細はリポジトリの <code className="rounded bg-gray-100 px-1 py-0.5">docs/api.md</code> を参照してください。
        </p>
      </header>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">利用状況</h2>
            <p className="mt-1 text-sm text-gray-500">
              {apiKey
                ? "APIキーが設定されており、REST API・MCPサーバーとも利用できます。"
                : "EXTERNAL_API_KEY が未設定のため、書き込み系APIとMCPは利用できません。Vercelの環境変数で設定してください。"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              apiKey ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {apiKey ? "有効" : "未設定"}
          </span>
        </div>
      </section>

      <section className={`${card} space-y-4`}>
        <h2 className="font-semibold text-gray-900">接続情報</h2>
        <div>
          <p className="mb-1 text-xs text-gray-600">ベースURL</p>
          <p className={mono}>{origin}</p>
        </div>
        {apiKey && (
          <div>
            <p className="mb-1 text-xs text-gray-600">
              APIキー（<code>Authorization: Bearer &lt;このキー&gt;</code> として使用）
            </p>
            <p className={mono}>{apiKey}</p>
            <p className="mt-1 text-xs text-amber-700">
              このキーは予約の作成・変更・キャンセルまで実行できます。外部に公開しないでください。
              漏洩した場合はVercelの環境変数で再生成し、再デプロイしてください。
            </p>
          </div>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-gray-900">Claude Codeから接続する</h2>
        <pre className={pre}>{claudeCmd}</pre>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-gray-900">動作確認（curl）</h2>
        <pre className={pre}>{curlCmd}</pre>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-gray-900">利用できるMCPツール（{TOOLS.length}件）</h2>
        <ul className="divide-y divide-gray-100">
          {TOOLS.map((tool) => (
            <li key={tool.name} className="py-2 text-sm">
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{tool.name}</code>
              <span className="ml-2 text-gray-600">{tool.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold text-gray-900">REST APIエンドポイント</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="pb-2 pr-4">メソッド</th>
                <th className="pb-2 pr-4">パス</th>
                <th className="pb-2 pr-4">認証</th>
                <th className="pb-2">説明</th>
              </tr>
            </thead>
            <tbody>
              {REST_ENDPOINTS.map((e) => (
                <tr key={`${e.method} ${e.path}`} className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-700">{e.method}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-700">{e.path}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{e.auth}</td>
                  <td className="py-2 text-gray-700">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${card} space-y-2`}>
        <h2 className="font-semibold text-gray-900">注意事項</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>予約作成・キャンセルなど取り消せない操作は、外部連携でも実行前に内容確認を挟むこと。</li>
          <li>キャンセルは取り消し不可。実行前に必ず金額を提示し、明確な同意を得ること。</li>
          <li>現状は単一の共有キーのみ対応。パートナーごとのキー分離は未対応。</li>
        </ul>
      </section>
    </div>
  );
}
