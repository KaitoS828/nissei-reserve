import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/reserve" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-[10px] leading-tight text-gray-600">
              日靜
            </span>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              一棟貸し宿「日靜」
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/reserve" className="font-medium text-teal-700">
              予約
            </Link>
            <Link href="/reserve/lookup" className="text-gray-500 hover:text-gray-800">
              予約照会
            </Link>
            <Link href="/account" className="text-gray-500 hover:text-gray-800">
              マイページ
            </Link>
            <Link href="/account/login" className="text-gray-500 hover:text-gray-800">
              ログイン
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

      <footer className="mt-16 border-t border-gray-200 py-8 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-4 text-sm text-gray-500">
          <span>About Us</span>
          <span className="text-gray-300">|</span>
          <Link href="/reserve/lookup" className="hover:text-gray-800">予約照会</Link>
          <span className="text-gray-300">|</span>
          <span>利用規約</span>
          <span className="text-gray-300">|</span>
          <span>プライバシーポリシー</span>
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} 一棟貸し宿「日靜」
        </p>
      </footer>
    </div>
  );
}
