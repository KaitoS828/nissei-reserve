import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";

// 公開中プランは増減するため、リクエスト時に組み立てる
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  // 日英で内容が同じページは alternates を付ける。
  // これが無いと Google が英語版を重複ページとみなす。
  const bilingual = (path: string) => ({
    languages: { ja: `${base}${path}`, en: `${base}/en${path}` },
  });

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/reserve`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
      alternates: bilingual("/reserve"),
    },
    {
      url: `${base}/en/reserve`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: bilingual("/reserve"),
    },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // DB が落ちていてもサイトマップごと失わない
  try {
    const { data } = await createAdminClient()
      .from("plans")
      .select("id, updated_at")
      .eq("is_active", true)
      .order("sort_order");

    return [
      ...staticEntries,
      ...(data ?? []).flatMap((plan) => {
        const lastModified = plan.updated_at ? new Date(plan.updated_at as string) : now;
        const alternates = bilingual(`/reserve/${plan.id}`);
        return [
          { url: `${base}/reserve/${plan.id}`, lastModified, changeFrequency: "weekly" as const, priority: 0.8, alternates },
          { url: `${base}/en/reserve/${plan.id}`, lastModified, changeFrequency: "weekly" as const, priority: 0.8, alternates },
        ];
      }),
    ];
  } catch {
    return staticEntries;
  }
}
