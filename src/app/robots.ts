import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// 管理画面と、個人情報・予約番号を含む画面はクロールさせない。
// 英語版は別URLなので、同じパスを /en 付きでも塞ぐ必要がある。
const PRIVATE_PATHS = [
  "/account",
  "/checkin",
  "/register",
  "/reserve/form",
  "/reserve/abandon",
  "/reserve/complete",
  "/reserve/lookup",
  "/reserve/receipt",
  "/reserve/cancel",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        ...PRIVATE_PATHS,
        ...PRIVATE_PATHS.map((p) => `/en${p}`),
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
