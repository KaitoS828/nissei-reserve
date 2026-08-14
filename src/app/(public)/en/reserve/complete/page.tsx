import type { Metadata } from "next";
import { CompleteScreen } from "@/app/(public)/reserve/complete/CompleteScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Booking confirmed | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  return <CompleteScreen code={code} token={token} locale="en" />;
}
