import type { Metadata } from "next";
import { CheckinScreen } from "./CheckinScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "チェックイン",
  description: "ご予約番号とメールアドレスで、玄関のドアコードをご確認いただけます。",
  robots: { index: false, follow: false },
  alternates: { languages: { ja: "/checkin", en: "/en/checkin" } },
};

export default function CheckinPage() {
  return <CheckinScreen locale="ja" />;
}
