import { createClient } from "@/lib/supabase/server";
import { EnrollTotp } from "./EnrollTotp";
import { unenrollFactor } from "./actions";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default async function SecurityPage() {
  const supabase = await createClient();
  const [{ data: factors, error }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const verified = (factors?.totp ?? []).filter((factor) => factor.status === "verified");
  const enabled = verified.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">セキュリティ</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理画面のログインに、パスワードに加えて認証アプリの6桁コードを要求します。
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">2段階認証</h2>
            <p className="mt-1 text-sm text-gray-500">
              {enabled
                ? "有効です。次回ログインから6桁コードの入力が必要になります。"
                : "未設定です。予約情報と個人情報を扱うため、有効化を強くおすすめします。"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {enabled ? "有効" : "未設定"}
          </span>
        </div>

        <div className="mt-5 border-t border-gray-200 pt-5">
          {enabled ? (
            <div className="space-y-3">
              {verified.map((factor) => (
                <div
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {factor.friendly_name || "認証アプリ"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      登録日: {formatDate(factor.created_at)}
                    </p>
                  </div>
                  <form action={unenrollFactor}>
                    <input type="hidden" name="factor_id" value={factor.id} />
                    <button className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50">
                      解除する
                    </button>
                  </form>
                </div>
              ))}
              <div className="pt-2">
                <EnrollTotp />
              </div>
            </div>
          ) : (
            <EnrollTotp />
          )}
        </div>
      </section>

      <section className={`${card} text-sm leading-6 text-gray-600`}>
        <h2 className="font-semibold text-gray-900">運用上の注意</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            端末を紛失すると管理画面に入れなくなります。登録時に表示されるキーを控えるか、
            複数の端末に同じ認証アプリを登録しておいてください。
          </li>
          <li>
            締め出された場合は、Supabase ダッシュボードの Authentication → Users から
            該当ユーザーの factor を削除すれば解除できます。
          </li>
          <li>
            現在のセッションのレベル: <code className="font-mono text-xs">{aal?.currentLevel ?? "—"}</code>
            （要求レベル: <code className="font-mono text-xs">{aal?.nextLevel ?? "—"}</code>）
          </li>
        </ul>
      </section>
    </div>
  );
}
