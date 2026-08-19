"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/links";

function back(msg: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
}

function done(msg: string): never {
  redirect(`${PATH}?done=${encodeURIComponent(msg)}`);
}

export async function saveAdminLink(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "その他").trim() || "その他";
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!title) back("タイトルを入力してください");
  if (!url) back("URLを入力してください");
  if (!/^https?:\/\//i.test(url)) back("URLは http:// または https:// で始めてください");

  const payload = {
    title,
    url,
    category,
    description,
    sort_order: isNaN(sortOrder) ? 0 : sortOrder,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from("admin_links").update(payload).eq("id", id)
    : await supabase.from("admin_links").insert(payload);

  if (error) {
    back(`保存に失敗しました: ${error.message}`);
  }

  await auditLog(supabase, {
    action: id ? "admin_link_update" : "admin_link_create",
    entityType: "admin_links",
    entityId: id || null,
    summary: `リンク「${title}」を${id ? "更新" : "追加"}しました`,
  }).catch(() => {});

  revalidatePath(PATH);
  revalidatePath("/admin");
  done(id ? "リンクを更新しました" : "リンクを追加しました");
}

export async function deleteAdminLink(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? id).trim();

  if (!id) back("対象のリンクIDが指定されていません");

  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_links").delete().eq("id", id);

  if (error) {
    back(`削除に失敗しました: ${error.message}`);
  }

  await auditLog(supabase, {
    action: "admin_link_delete",
    entityType: "admin_links",
    entityId: id,
    summary: `リンク「${title}」を削除しました`,
  }).catch(() => {});

  revalidatePath(PATH);
  revalidatePath("/admin");
  done("リンクを削除しました");
}

export async function toggleAdminLink(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const isActive = String(formData.get("is_active")) === "true";

  if (!id) back("対象のリンクIDが指定されていません");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("admin_links")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    back(`状態の更新に失敗しました: ${error.message}`);
  }

  revalidatePath(PATH);
  revalidatePath("/admin");
  done(isActive ? "リンクを有効にしました" : "リンクを無効にしました");
}
