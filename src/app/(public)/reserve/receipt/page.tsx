import { ReceiptScreen } from "./ReceiptScreen";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  return <ReceiptScreen code={code} token={token} locale="ja" />;
}
