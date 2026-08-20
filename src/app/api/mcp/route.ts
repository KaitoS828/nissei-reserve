import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { TOOLS, toolImpls } from "@/lib/slack-agent";
import { checkApiKey } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Anthropic Tool の JSON Schema（type/description/enumのみのフラットなプロパティ）を
// registerTool が要求する Zod raw shape に変換する。
type JsonSchemaProp = { type?: string; description?: string; enum?: string[] };
function toZodShape(schema: {
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
}): Record<string, z.ZodTypeAny> {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    let field: z.ZodTypeAny = prop.enum
      ? z.enum(prop.enum as [string, ...string[]])
      : prop.type === "number"
        ? z.number()
        : z.string();
    if (prop.description) field = field.describe(prop.description);
    if (!required.has(key)) field = field.optional();
    shape[key] = field;
  }
  return shape;
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "nissei-reserve", version: "1.0.0" });
  for (const tool of TOOLS) {
    const impl = toolImpls[tool.name];
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: toZodShape(tool.input_schema as { properties?: Record<string, JsonSchemaProp>; required?: string[] }),
      },
      async (args: Record<string, unknown>) => {
        const text = await impl(args);
        return { content: [{ type: "text" as const, text }] };
      },
    );
  }
  return server;
}

async function handle(req: Request): Promise<Response> {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const limited = rateLimit(`mcp:${req.headers.get("authorization") ?? "unknown"}`, 60, 60_000);
  if (!limited.ok) {
    return Response.json({ error: "リクエストが多すぎます" }, { status: 429 });
  }

  // ステートレス: リクエストごとにサーバー・トランスポートを使い捨てる
  // （書き込み系ツールを含むためセッション状態は持たず、都度独立させる）
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}
