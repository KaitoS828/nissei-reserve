import { ReserveScreen } from "./ReserveScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/reserve", languages: { ja: "/reserve", en: "/en/reserve" } },
};

export default function ReservePage() {
  return <ReserveScreen locale="ja" />;
}
