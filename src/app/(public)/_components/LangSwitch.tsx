"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { altPath, dict, type Locale } from "@/lib/i18n";

// 相手言語の同じ内容のページへ移動する。URLを分けているので、
// 切り替えた先がそのまま検索対象になる。
export function LangSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const to: Locale = locale === "en" ? "ja" : "en";

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
