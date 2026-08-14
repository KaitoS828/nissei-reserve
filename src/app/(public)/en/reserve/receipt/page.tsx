import type { Metadata } from "next";
import { ReceiptScreen } from "@/app/(public)/reserve/receipt/ReceiptScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Receipt | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const { code, token } = await searchParams;
  return <ReceiptScreen code={code} token={token} locale="en" />;
}
