import Link from "next/link";
import { login } from "../actions";

const field = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirm?: string }>;
}) {
  const { error, confirm } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">会員ログイン</h1>
      {confirm && <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">確認メールを送信しました。メール内のリンクで認証後にログインしてください。</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <form action={login} className="space-y-3 rounded-2xl border border-gray-200 p-6">
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">メールアドレス</span>
          <input type="email" name="email" required autoComplete="email" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">パスワード</span>
          <input type="password" name="password" required autoComplete="current-password" className={field} />
        </label>
        <button className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-500">ログイン</button>
      </form>
      <p className="text-center text-sm text-gray-500">
        初めての方は <Link href="/account/signup" className="text-teal-700 hover:underline">会員登録</Link>
      </p>
    </div>
  );
}
