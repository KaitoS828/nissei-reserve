import Image from "next/image";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-800 font-light">
      <form
        action={login}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-gray-200 bg-white p-8"
      >
        <div className="space-y-1">
          <Image src="/logo.png" alt="日靜" width={40} height={40} className="mb-2 h-10 w-10" priority />
          <h1 className="text-xl font-semibold text-gray-900">nissei 管理</h1>
          <p className="text-sm text-gray-600">管理画面にログイン</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <input type="hidden" name="redirect" value={redirect ?? "/admin"} />

        <label className="block space-y-1">
          <span className="text-sm text-gray-600">メールアドレス</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 outline-none focus:border-cyan-600"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-gray-600">パスワード</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 outline-none focus:border-cyan-600"
          />
        </label>

        <SubmitButton
          className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white transition hover:bg-cyan-700"
        >
          ログイン
        </SubmitButton>
      </form>
    </main>
  );
}
