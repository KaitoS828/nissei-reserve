import { NextRequest, NextResponse } from "next/server";
import { importAllIcalSources } from "@/lib/ical-import";
import { authorizeCron } from "@/lib/cron-auth";

async function handle(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await importAllIcalSources();
  return NextResponse.json(result);
}

// Vercel Cron は GET で叩く。外部cron・手動実行は POST を使う。
export const GET = handle;
export const POST = handle;
