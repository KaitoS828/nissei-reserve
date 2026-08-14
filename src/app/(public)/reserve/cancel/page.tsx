import { CancelScreen } from "./CancelScreen";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; error?: string }>;
}) {
  const { code, email, error } = await searchParams;
  return <CancelScreen code={code} email={email} error={error} locale="ja" />;
}
