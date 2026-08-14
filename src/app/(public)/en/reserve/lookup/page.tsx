import type { Metadata } from "next";
import { LookupScreen } from "@/app/(public)/reserve/lookup/LookupScreen";

export const dynamic = "force-dynamic";

// 予約番号とメールを扱う画面なので、日本語版と同じく検索対象から外す。
export const metadata: Metadata = {
  title: { absolute: "Find or cancel your booking | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; cancelled?: string }>;
}) {
  const { code, email, cancelled } = await searchParams;
  return <LookupScreen code={code} email={email} cancelled={cancelled} locale="en" />;
}
