import { CancelDoneScreen } from "./CancelDoneScreen";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function CancelDonePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <CancelDoneScreen code={code} locale="ja" />;
}
