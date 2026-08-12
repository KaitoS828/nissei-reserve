import type { Metadata } from "next";
import { CheckinScreen } from "@/app/(public)/checkin/CheckinScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check-in",
  description: "Enter your booking details to see the door code for the entrance.",
  robots: { index: false, follow: false },
  alternates: { languages: { ja: "/checkin", en: "/en/checkin" } },
};

export default function EnCheckinPage() {
  return <CheckinScreen locale="en" />;
}
