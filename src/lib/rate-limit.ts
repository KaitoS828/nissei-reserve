// 公開エンドポイント向けの簡易レート制限。
// 外部ストア（Redis等）を増やさずに済ませるため、プロセス内メモリで持つ。
// サーバーレスではインスタンスごとの計数になるため厳密な上限ではないが、
// 単一施設・低トラフィック運用では連打と空打ちを止めるには十分。

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number): void {
  // 上限に達したときだけ掃除する（毎回全走査しない）
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// プロキシ経由の実クライアントIP。取得できない場合は "unknown" に寄せる
// （同一扱いになるが、制限を素通りさせるよりは安全側）。
export async function clientIp(): Promise<string> {
  // next/headers はリクエスト文脈でしか使えないため、読み込み時ではなく呼び出し時に解決する
  const { headers } = await import("next/headers");
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function ipFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

// テスト用。計数をリセットする。
export function resetRateLimits(): void {
  buckets.clear();
}
