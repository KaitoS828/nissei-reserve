import type { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyFailure } from "@/lib/notify";

type Handler = (req: NextRequest) => Promise<NextResponse>;

// cron の実行結果を cron_runs に残し、失敗したら Slack に知らせる。
// 認証エラー（401）は外部からの不正アクセスなので記録しない。
// 記録の失敗で cron 本体を止めない（テーブル未作成でも動く）。
export function withCronLog(job: string, handler: Handler): Handler {
  return async (req) => {
    const startedAt = Date.now();

    async function record(ok: boolean, summary: unknown, error: string | null) {
      try {
        await createAdminClient().from("cron_runs").insert({
          job,
          ok,
          duration_ms: Date.now() - startedAt,
          summary: summary ?? null,
          error,
        });
      } catch {}
      if (!ok) await notifyFailure(`自動実行: ${job}`, error ?? "失敗");
    }

    let res: NextResponse;
    try {
      res = await handler(req);
    } catch (e) {
      await record(false, null, e instanceof Error ? e.message : String(e));
      throw e;
    }
    if (res.status === 401) return res;

    const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const errors = Array.isArray(body?.errors) ? (body!.errors as unknown[]).map(String) : [];
    const bodyError = typeof body?.error === "string" ? body.error : null;
    const failed = !res.ok || bodyError !== null || errors.length > 0;
    await record(!failed, body, failed ? (bodyError ?? errors.join(" / ")) || `HTTP ${res.status}` : null);
    return res;
  };
}
