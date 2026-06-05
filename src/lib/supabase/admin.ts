import { createClient } from "@supabase/supabase-js";

// service role キーを使うサーバ専用クライアント。RLS をバイパスするため
// 公開ルートやクライアントコンポーネントから絶対に import しないこと。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
