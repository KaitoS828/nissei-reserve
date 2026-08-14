import type { Metadata } from "next";
import { ReserveScreen } from "@/app/(public)/reserve/ReserveScreen";

export const dynamic = "force-dynamic";

// 英語圏からの検索流入の入口。日本語ページと違い absolute で英語タイトルを出す
// （既定のテンプレートだと日本語の宿名が後ろに付いてしまう）。
export const metadata: Metadata = {
  title: {
    absolute: "Book your stay | Nissei — private house with sauna, Hiroo, Hokkaido",
  },
  description:
    "Book Nissei, a whole-house rental with a private sauna in Hiroo, Hokkaido. One group per day. Check availability and rates, and reserve online.",
  alternates: { canonical: "/en/reserve", languages: { ja: "/reserve", en: "/en/reserve" } },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Book your stay | Nissei — private house with sauna, Hiroo, Hokkaido",
    description:
      "A whole-house rental with a private sauna in Hiroo, Hokkaido. One group per day.",
    url: "/en/reserve",
  },
  // 上書きしないと root layout の日本語がそのまま共有カードに出る
  twitter: {
    card: "summary_large_image",
    title: "Book your stay | Nissei — private house with sauna, Hiroo, Hokkaido",
    description:
      "A whole-house rental with a private sauna in Hiroo, Hokkaido. One group per day.",
  },
};

export default function EnReservePage() {
  return <ReserveScreen locale="en" />;
}
