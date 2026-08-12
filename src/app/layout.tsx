import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SITE, siteUrl } from "@/lib/site";

const GA_ID = "G-TWZ6JXXCSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 検索結果とSNSに出るのはここ。読むのは宿を探しているお客様なので、
// システムの説明ではなく宿の紹介を書く。
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name}｜${SITE.tagline}`,
    template: `%s｜${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "広尾町 宿",
    "十勝 サウナ 貸切",
    "北海道 一棟貸し",
    "KOBU SAUNA",
    "日靜",
    "貸切サウナ 宿泊",
  ],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE.name,
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
    url: siteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
  },
  alternates: { canonical: siteUrl() },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-200">
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
