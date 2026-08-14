import { LookupScreen } from "./LookupScreen";

export const dynamic = "force-dynamic";

// 予約番号とメールを扱う画面なので検索対象から外す（robots.txt でも塞いでいる）。
export const metadata = { robots: { index: false, follow: false } };

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; cancelled?: string }>;
}) {
  const { code, email, cancelled } = await searchParams;
  return <LookupScreen code={code} email={email} cancelled={cancelled} locale="ja" />;
}
