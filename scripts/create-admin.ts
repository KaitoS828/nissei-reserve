/**
 * 管理者ユーザーを追加・昇格するスクリプト。
 * service role キーで Supabase Auth にユーザーを作り app_metadata.role='admin' を付与する。
 *
 * 使い方:
 *   npx tsx scripts/create-admin.ts <email> [password]
 *
 *   - password 省略時: 既存ユーザーを admin に昇格するのみ（新規作成時は必須）。
 *   - 既存ユーザーの場合: role を admin に更新し、password 指定時はパスワードも更新。
 *
 * 必要な環境変数（.env.local）:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
process.loadEnvFile(".env.local");

import { createAdminClient } from "../src/lib/supabase/admin";

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  // listUsers はページング。1000件/ページで全走査する。
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email) {
    console.error("使い方: npx tsx scripts/create-admin.ts <email> [password]");
    process.exit(1);
  }

  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "admin" },
      ...(password ? { password } : {}),
    });
    if (error) throw error;
    console.log(`昇格しました: ${email} (role=admin${password ? ", パスワード更新済み" : ""})`);
    return;
  }

  if (!password) {
    console.error(`ユーザーが存在しません。新規作成にはパスワードが必要です: ${email}`);
    process.exit(1);
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (error) throw error;
  console.log(`作成しました: ${email} (role=admin)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
