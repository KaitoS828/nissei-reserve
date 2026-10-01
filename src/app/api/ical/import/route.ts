import { NextRequest, NextResponse } from "next/server";
import { importAllIcalSources, findStaleIcalSources } from "@/lib/ical-import";
import { authorizeCron } from "@/lib/cron-auth";
import { withCronLog } from "@/lib/cron-log";

async function handle(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await importAllIcalSources();
  // 取込のあとでも古いままの取込元は、今回も失敗したか、取込がずっと止まっている。
  const stale = await findStaleIcalSources();
  const errors = [
    ...result.errors,
    ...stale.map((name) => `${name}: 24時間以上同期されていません`),
  ];
  return NextResponse.json({ ...result, errors });
}

// Vercel Cron は GET で叩く。外部cron・手動実行は POST を使う。
const logged = withCronLog("ical-import", handle);
export const GET = logged;
export const POST = logged;
