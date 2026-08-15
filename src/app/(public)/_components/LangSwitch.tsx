"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { altPath, dict, hasEnglishVersion, type Locale } from "@/lib/i18n";

// 相手言語の同じ内容のページへ移動する。URLを分けているので、
// 切り替えた先がそのまま検索対象になる。
// 英語版が無いページで English を出すと 404 になるため、その場合は出さない。
export function LangSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const to: Locale = locale === "en" ? "ja" : "en";

  if (to === "en" && !hasEnglishVersion(pathname)) return null;

  return (
    <Link
      href={altPath(pathname, to)}
      hrefLang={to}
      className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50"
    >
      {dict(locale).common.switchLang}
    </Link>
  );
}
