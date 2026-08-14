import { FormScreen } from "./FormScreen";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function ReserveFormPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string; to?: string; guests?: string; error?: string; n?: string }>;
}) {
  const { plan, from, to, guests, error, n } = await searchParams;
  return (
    <FormScreen planId={plan} from={from} to={to} guests={guests} error={error} errorNum={n} locale="ja" />
  );
}
