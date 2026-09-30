"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavGroup = { group: string; items: { href: string; label: string }[] };

// サイドバーにまとめたグループの中のページを、ページ上部のタブで行き来する
export function SectionTabs({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);
  const current = groups.find((g) => g.items.length > 1 && g.items.some((i) => isActive(i.href)));
  if (!current) return null;

  return (
    <nav aria-label={current.group} className="-mt-1 mb-6 overflow-x-auto border-b border-gray-300">
      <ul className="flex min-w-max gap-1">
        {current.items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={isActive(i.href) ? "page" : undefined}
              className={`block border-b-2 px-4 py-2.5 text-sm transition ${
                isActive(i.href)
                  ? "border-cyan-600 font-bold text-cyan-800"
                  : "border-transparent text-gray-700 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
