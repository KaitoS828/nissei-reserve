import type { Metadata } from "next";
import { CancelDoneScreen } from "@/app/(public)/reserve/cancel/done/CancelDoneScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Booking cancelled | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnCancelDonePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <CancelDoneScreen code={code} locale="en" />;
}
