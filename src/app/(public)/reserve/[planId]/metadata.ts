import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/lib/i18n";

const EN_SUFFIX = "Nissei — private house with sauna, Hiroo, Hokkaido";

/** プラン詳細の title と hreflang。日英で同じ関数を使う。 */
export async function planMetadata(planId: string, locale: Locale): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("plans")
    .select("name, description")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  const languages = { ja: `/reserve/${planId}`, en: `/en/reserve/${planId}` };
  if (!data) return { alternates: { languages } };

  // 英語ページは既定のテンプレート（日本語の宿名が付く）を使わない
  const title = locale === "en" ? `${data.name} | ${EN_SUFFIX}` : data.name;
  const description = data.description ?? undefined;

  return {
    title: locale === "en" ? { absolute: title } : title,
    description,
    alternates: { canonical: languages[locale], languages },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ja_JP",
      title,
      description,
      url: languages[locale],
    },
    // 上書きしないと root layout の日本語がそのまま共有カードに出る
    twitter: { card: "summary_large_image", title, description },
  };
}
