import { lodgingJsonLd } from "@/lib/site";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { HtmlLang } from "./_components/HtmlLang";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandColorCssVars, resolveBrandColor } from "@/lib/brand-colors";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 管理画面「カスタマイズ」で選んだアクセントカラーをCSS変数として注入する。
  // 未設定ならデフォルト(ティール)のままglobals.cssの値が使われる。
  const supabase = createAdminClient();
  const { data: facility } = await supabase.from("facility").select("settings").limit(1).maybeSingle();
  const brandColor = resolveBrandColor((facility?.settings as Record<string, unknown> | null)?.brand_color);

  return (
    <div className="min-h-screen bg-white text-gray-800 font-serif">
      <style dangerouslySetInnerHTML={{ __html: `:root{${brandColorCssVars(brandColor)}}` }} />
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
