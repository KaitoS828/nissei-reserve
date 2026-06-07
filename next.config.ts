import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const root = dirname(fileURLToPath(import.meta.url));

// セキュリティ向けレスポンスヘッダ（全ルートに適用）
const securityHeaders = [
  // HTTPS を強制（1年・サブドメイン含む）
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // MIME スニッフィング防止
  { key: "X-Content-Type-Options", value: "nosniff" },
  // クリックジャッキング防止（iframe 埋め込み禁止）
  { key: "X-Frame-Options", value: "DENY" },
  // リファラ流出を抑制
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 不要なブラウザ機能を無効化
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // 親ディレクトリの lockfile を誤検出しないよう、トレースのルートを固定
  outputFileTracingRoot: root,
  // X-Powered-By を隠す（スタック露出を減らす）
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    // OMC の HUD が書き込む .omc/ を監視対象外にして
    // 無駄な再コンパイル（→devキャッシュ破損）を防ぐ
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.omc/**"],
    };
    return config;
  },
};

export default nextConfig;
