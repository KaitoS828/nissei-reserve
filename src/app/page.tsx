import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">
          nissei <span className="text-cyan-400">予約</span>
        </h1>
        <p className="text-sm text-gray-400">広尾町のサウナ宿</p>
      </div>
      <Link
        href="/reserve"
        className="rounded-lg bg-cyan-500 px-6 py-3 font-medium text-gray-950 transition hover:bg-cyan-400"
      >
        予約する
      </Link>
    </main>
  );
}
