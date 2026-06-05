"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const lastName = String(formData.get("last_name") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/account/signup?error=${encodeURIComponent(error.message)}`);

  // customers に会員として紐付け（同メールがあれば auth_user_id を更新）
  if (data.user) {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("customers").select("id").eq("email", email).maybeSingle();
    if (existing) {
      await admin.from("customers").update({ auth_user_id: data.user.id, is_member: true, last_name: lastName || null, first_name: firstName || null }).eq("id", existing.id);
    } else {
      await admin.from("customers").insert({ auth_user_id: data.user.id, email, is_member: true, last_name: lastName || null, first_name: firstName || null });
    }
  }

  // セッションが返ればログイン済み、無ければ確認メール待ち
  if (data.session) redirect("/account");
  redirect("/account/login?confirm=1");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/account/login?error=${encodeURIComponent(error.message)}`);
  redirect("/account");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/account/login");
}
