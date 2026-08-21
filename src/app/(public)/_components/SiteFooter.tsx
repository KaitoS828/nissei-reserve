"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dict, localeOf, localePath } from "@/lib/i18n";

// 利用規約とプライバシーポリシーはまだ日本語ページしかない。
// ラベルだけ英語にして、リンク先は日本語ページのままにしている。
export function SiteFooter() {
  const locale = localeOf(usePathname());
  const t = dict(locale);

  return (
    <footer className="mt-12 border-t border-gray-200 py-8 sm:mt-16 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-sm text-gray-500">
        <span>{t.site.about}</span>
        <span className="text-gray-300">|</span>
        <Link href={localePath(locale, "/reserve/lookup")} className="hover:text-gray-800">{t.nav.lookup}</Link>
        <span className="text-gray-300">|</span>
        <Link href="/faq" className="hover:text-gray-800">{t.site.faq}</Link>
        <span className="text-gray-300">|</span>
        <Link href="/terms" className="hover:text-gray-800">{t.site.terms}</Link>
        <span className="text-gray-300">|</span>
        <Link href="/privacy" className="hover:text-gray-800">{t.site.privacy}</Link>
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {t.site.name}
      </p>
    </footer>
  );
}
