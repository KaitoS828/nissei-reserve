import { logout } from "@/app/admin/login/actions";
import { verifyMfa } from "./actions";

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 font-light">
      <div className="w-full max-w-sm space-y-4">
        <form
          action={verifyMfa}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-900">2段階認証</h1>
            <p className="text-sm text-gray-500">認証アプリに表示されている6桁の数字を入力してください</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <input type="hidden" name="redirect" value={redirect ?? "/admin"} />

          <label className="block space-y-1">
            <span className="text-sm text-gray-500">認証コード</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-gray-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white transition hover:bg-cyan-700"
          >
            認証する
          </button>
        </form>

        <form action={logout} className="text-center">
          <button className="text-xs text-gray-500 underline hover:text-gray-800">
            別のアカウントでログインし直す
          </button>
        </form>
      </div>
    </main>
  );
}
