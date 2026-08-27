import { ReserveScreen } from "./ReserveScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/reserve", languages: { ja: "/reserve", en: "/en/reserve" } },
};

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    checkin?: string;
    checkout?: string;
    guests?: string;
  }>;
}) {
  // from/to (社内表記) と checkin/checkout (外部リンク向けの一般的な表記) の両方を受け付ける
  const { from, to, checkin, checkout, guests } = await searchParams;
  return (
    <ReserveScreen locale="ja" from={from ?? checkin} to={to ?? checkout} guests={guests} />
  );
}
