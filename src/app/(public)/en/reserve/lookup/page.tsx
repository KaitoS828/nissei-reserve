import type { Metadata } from "next";
import { LookupScreen } from "@/app/(public)/reserve/lookup/LookupScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Find or cancel your booking | Nissei" },
  description: "Look up your booking at Nissei with your booking number and email address, or request a cancellation.",
  alternates: { canonical: "/en/reserve/lookup", languages: { ja: "/reserve/lookup", en: "/en/reserve/lookup" } },
};

export default async function EnLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; cancelled?: string }>;
}) {
  const { code, email, cancelled } = await searchParams;
  return <LookupScreen code={code} email={email} cancelled={cancelled} locale="en" />;
}
