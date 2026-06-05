import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // 親ディレクトリの lockfile を誤検出しないよう、トレースのルートを固定
  outputFileTracingRoot: root,
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
