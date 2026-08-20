import { NextResponse } from "next/server";

// 外部API/MCP共通の認証。Authorization: Bearer <EXTERNAL_API_KEY> のみを受け付ける。
// 未設定時は誰も通さない（安全側に倒す）。
export function checkApiKey(req: Request): NextResponse | null {
  const expected = process.env.EXTERNAL_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "APIが未設定です（EXTERNAL_API_KEY未設定）" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== expected) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }
  return null;
}
