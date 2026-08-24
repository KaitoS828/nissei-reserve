import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP, Inter } from "next/font/google";
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

// 管理画面・公開画面共通の日本語UI用（Geistはラテン文字のみのため日本語はOSフォント任せになっていた）
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

// 管理画面のラテン文字（英数字）用。Noto Sans JPのラテン字形より
// Interの方が近いイメージだったため、ラテン文字だけこちらを優先させる
const inter = Inter({
  variable: "--font-inter",
  weight: ["300", "400", "500", "700"],
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
  verification: { google: "8Y0AKwGa_uUyV7Clyxb8thAjaI9RoLF0qHATRrHHX8g" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Zen Old Mincho: next/fontのローカル最適化だとサブセット定義に日本語が無く
            日本語グリフが削られてしまうため、この書体だけはGoogle Fontsから直接読み込む */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
