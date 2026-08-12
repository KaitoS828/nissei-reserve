import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 管理画面と、個人情報・予約番号を含む画面はクロールさせない
      disallow: [
        "/admin",
        "/api",
        "/account",
        "/checkin",
        "/register",
        "/reserve/form",
        "/reserve/abandon",
        "/reserve/complete",
        "/reserve/lookup",
        "/reserve/receipt",
        "/reserve/cancel",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
