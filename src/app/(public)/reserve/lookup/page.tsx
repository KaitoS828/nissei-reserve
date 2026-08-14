import { LookupScreen } from "./LookupScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/reserve/lookup", languages: { ja: "/reserve/lookup", en: "/en/reserve/lookup" } },
};

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; cancelled?: string }>;
}) {
  const { code, email, cancelled } = await searchParams;
  return <LookupScreen code={code} email={email} cancelled={cancelled} locale="ja" />;
}
