import { CompleteScreen } from "./CompleteScreen";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  return <CompleteScreen code={code} token={token} locale="ja" />;
}
