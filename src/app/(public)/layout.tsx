import { lodgingJsonLd } from "@/lib/site";
import Link from "next/link";
import { SiteHeader } from "./_components/SiteHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* 宿泊施設としての構造化データ。検索結果に住所や設備が出るようにする */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: lodgingJsonLd() }}
      />
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>

      <footer className="mt-12 border-t border-gray-200 py-8 sm:mt-16 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-sm text-gray-500">
          <span>About Us</span>
          <span className="text-gray-300">|</span>
          <Link href="/reserve/lookup" className="hover:text-gray-800">予約照会</Link>
          <span className="text-gray-300">|</span>
          <Link href="/terms" className="hover:text-gray-800">利用規約</Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="hover:text-gray-800">プライバシーポリシー</Link>
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} 一棟貸し宿「日靜」
        </p>
      </footer>
    </div>
  );
}
