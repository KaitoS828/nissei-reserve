"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { localeOf } from "@/lib/i18n";

// ルートの layout は <html lang="ja"> 固定。/en 配下では読み上げソフトと
// ブラウザの翻訳判定が誤るので、描画後に直す。
// サーバ側で出し分けるには root layout で headers() を読む必要があり、
// 全ページが動的レンダリングになるため採らない。検索側は canonical と
// hreflang を見ているので、そちらは各ページの metadata で出している。
export function HtmlLang() {
  const locale = localeOf(usePathname());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
