import { lodgingJsonLd } from "@/lib/site";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { HtmlLang } from "./_components/HtmlLang";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-800 font-serif">
      {/* 宿泊施設としての構造化データ。検索結果に住所や設備が出るようにする */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: lodgingJsonLd() }}
      />
      <HtmlLang />
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>

      <SiteFooter />
    </div>
  );
}
