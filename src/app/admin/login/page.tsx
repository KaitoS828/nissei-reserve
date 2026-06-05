import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-gray-800 bg-gray-900/60 p-8"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-white">nissei 管理</h1>
          <p className="text-sm text-gray-400">管理画面にログイン</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <input type="hidden" name="redirect" value={redirect ?? "/admin"} />

        <label className="block space-y-1">
          <span className="text-sm text-gray-400">メールアドレス</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-gray-400">パスワード</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-medium text-gray-950 transition hover:bg-cyan-400"
        >
          ログイン
        </button>
      </form>
    </main>
  );
}
