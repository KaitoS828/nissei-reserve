"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "@/app/admin/login/actions";

type NavItem = { href: string; label: string };
type NavGroup = { group: string; items: NavItem[] };

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const links = (
    <nav className="flex flex-col gap-4 p-3">
      {groups.map((g) => (
        <div key={g.group} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-gray-400">
            {g.group}
          </p>
          {g.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2.5 text-sm transition md:py-2 ${
                isActive(item.href)
                  ? "bg-cyan-50 font-medium text-cyan-800"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-gray-200 p-3">
      <Link
        href="/admin/help"
        className="mb-1 block rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
      >
        ❓ 使い方・FAQ
      </Link>
      <form action={logout}>
        <SubmitButton className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
          ログアウト
        </SubmitButton>
      </form>
    </div>
  );

  return (
    <>
      {/* モバイル: 上部バー + ハンバーガー */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/logo.png" alt="日靜" width={28} height={28} className="h-7 w-7" />
          <span className="text-lg font-semibold text-gray-900">nissei</span>
          <span className="ml-1 text-sm text-cyan-700">予約</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="メニューを開く"
          aria-expanded={open}
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
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
            <path d="M3 6h14" />
            <path d="M3 10h14" />
            <path d="M3 14h14" />
          </svg>
        </button>
      </div>

      {/* モバイル: ドロワー */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-gray-900/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="flex items-center gap-2">
                <Image src="/logo.png" alt="日靜" width={28} height={28} className="h-7 w-7" />
                <span className="text-lg font-semibold text-gray-900">nissei</span>
                <span className="ml-1 text-sm text-cyan-700">予約</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="メニューを閉じる"
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
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
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{links}</div>
            {footer}
          </div>
        </div>
      )}

      {/* PC: 固定サイドバー */}
      <aside className="hidden shrink-0 flex-col border-r border-gray-200 bg-white md:flex md:w-56">
        <div className="border-b border-gray-200 px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.png" alt="日靜" width={28} height={28} className="h-7 w-7" />
            <span className="text-lg font-semibold text-gray-900">nissei</span>
            <span className="ml-1 text-sm text-cyan-700">予約</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">{links}</div>
        {footer}
      </aside>
    </>
  );
}
