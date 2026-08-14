"use client";

import { usePathname } from "next/navigation";
import { Spinner } from "@/components/SubmitButton";
import { dict, localeOf } from "@/lib/i18n";

// 画面遷移中に何も変わらないと、押せたのか分からない。
// /en 配下でも日本語が出ないよう、パスから言語を読む。
export default function PublicLoading() {
  const locale = localeOf(usePathname());

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{dict(locale).common.loading}</p>
    </div>
  );
}
