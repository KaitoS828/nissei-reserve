"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ログイン直後（aal1）に、登録済みTOTPで aal2 まで昇格させる
export async function verifyMfa(formData: FormData) {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const redirectTo = String(formData.get("redirect") ?? "/admin");

  const fail = (message: string): never => {
    const q = new URLSearchParams({ error: message, redirect: redirectTo });
    redirect(`/admin/mfa?${q.toString()}`);
  };

  if (!/^\d{6}$/.test(code)) fail("6桁の数字を入力してください");

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) fail(listError.message);

  const factor = factors?.totp?.[0];
  if (!factor) fail("認証アプリが登録されていません");

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor!.id,
    code,
  });
  if (error) fail(error.message);

  redirect(redirectTo);
}
