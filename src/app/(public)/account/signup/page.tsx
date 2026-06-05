import Link from "next/link";
import { signup } from "../actions";

const field = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

export default async function AccountSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">会員登録</h1>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <form action={signup} className="space-y-3 rounded-2xl border border-gray-200 p-6">
        <div className="flex gap-2">
          <input name="last_name" placeholder="姓" className={field} />
          <input name="first_name" placeholder="名" className={field} />
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">メールアドレス</span>
          <input type="email" name="email" required autoComplete="email" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-gray-700">パスワード（6文字以上）</span>
          <input type="password" name="password" required minLength={6} autoComplete="new-password" className={field} />
        </label>
        <button className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-500">登録する</button>
      </form>
      <p className="text-center text-sm text-gray-500">
        登録済みの方は <Link href="/account/login" className="text-teal-700 hover:underline">ログイン</Link>
      </p>
    </div>
  );
}
