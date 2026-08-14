import type { Metadata } from "next";
import { FormScreen } from "@/app/(public)/reserve/form/FormScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Your details | Nissei" },
  robots: { index: false, follow: false },
};

export default async function EnReserveFormPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string; to?: string; guests?: string; error?: string; n?: string }>;
}) {
  const { plan, from, to, guests, error, n } = await searchParams;
  return (
    <FormScreen planId={plan} from={from} to={to} guests={guests} error={error} errorNum={n} locale="en" />
  );
}
