"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dict, localeOf, localePath } from "@/lib/i18n";
import { LangSwitch } from "./LangSwitch";

// hasEn: 英語ページがある導線だけ /en を付ける。
// 無いものを /en に飛ばすと 404 になるので、日本語ページへ落とす。
const NAV = [
  { href: "/reserve", key: "reserve", hasEn: true },
  { href: "/reserve/lookup", key: "lookup", hasEn: true },
  { href: "/checkin", key: "checkin", hasEn: true },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const locale = localeOf(pathname);
  const t = dict(locale);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const hrefOf = (item: (typeof NAV)[number]) =>
    item.hasEn ? localePath(locale, item.href) : item.href;

  const isActive = (item: (typeof NAV)[number]) => {
    const href = hrefOf(item);
    return item.href === "/reserve"
      ? pathname.startsWith(href) && !pathname.startsWith(`${href}/lookup`)
      : pathname === href;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={localePath(locale, "/reserve")} className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt={t.site.name} width={36} height={36} className="h-9 w-9 shrink-0" priority />
          <span className="truncate text-base font-semibold tracking-tight text-gray-900 sm:text-lg">
            {t.site.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item)}
              className={
                isActive(item)
                  ? "font-medium text-teal-700"
                  : "text-gray-500 transition hover:text-gray-800"
              }
            >
              {t.nav[item.key]}
            </Link>
          ))}
          <LangSwitch locale={locale} />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LangSwitch locale={locale} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? (locale === "en" ? "Close menu" : "メニューを閉じる") : locale === "en" ? "Open menu" : "メニューを開く"}
            aria-expanded={open}
            aria-controls="site-menu"
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <>
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </>
              ) : (
                <>
                  <path d="M3 6h14" />
                  <path d="M3 10h14" />
                  <path d="M3 14h14" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          className="border-t border-gray-200 bg-white px-4 pb-3 pt-1 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={hrefOf(item)}
              className={`block rounded-lg px-3 py-3 text-sm ${
                isActive(item)
                  ? "bg-teal-50 font-medium text-teal-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {t.nav[item.key]}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
