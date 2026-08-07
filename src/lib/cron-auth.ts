// 自動実行APIの認証。シークレット未設定なら「素通り」ではなく実行拒否する。
// 設定漏れを許すと、外部から叩ける公開エンドポイントを開けたのと同じになる。

import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type CronAuthResult = { ok: true } | { ok: false; status: number; error: string };

function equals(input: string | null, expected: string): boolean {
  if (!input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// x-cron-secret ヘッダ（外部cron・手動実行）と
// Authorization: Bearer（Vercel Cron が CRON_SECRET を送る形式）の両方を受ける。
export async function authorizeCron(req: NextRequest): Promise<CronAuthResult> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, status: 503, error: "CRON_SECRET が未設定です" };
  }

  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (equals(header, expected) || equals(bearer, expected)) return { ok: true };

  return { ok: false, status: 401, error: "unauthorized" };
}
