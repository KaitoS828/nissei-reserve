import type { Metadata } from "next";
import { CancelScreen } from "@/app/(public)/reserve/cancel/CancelScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Cancel your booking | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; error?: string }>;
}) {
  const { code, email, error } = await searchParams;
  return <CancelScreen code={code} email={email} error={error} locale="en" />;
}
