"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { importAllIcalSources, importIcalSource } from "@/lib/ical-import";

const PATH = "/admin/ical";

function back(msg: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
}

export async function saveIcalSource(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!name || !url) back("名称とURLは必須です");
  if (!/^https?:\/\//i.test(url)) back("URLは http:// または https:// で始めてください");

  const payload = {
    name,
    url,
    source_type: String(formData.get("source_type") ?? "external").trim() || "external",
    room_type_id: String(formData.get("room_type_id") ?? "") || null,
    note: String(formData.get("note") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from("ical_sources").update(payload).eq("id", id)
    : await supabase.from("ical_sources").insert(payload);
  if (error) back(error.message);

  await auditLog(supabase, {
    action: id ? "ical_source_update" : "ical_source_create",
    entityType: "ical_source",
    entityId: id || null,
    summary: `iCal連携「${name}」を${id ? "更新" : "追加"}しました`,
  }).catch(() => {});

  revalidatePath(PATH);
}

export async function toggleIcalSource(formData: FormData) {
  const id = String(formData.get("id"));
  const isActive = String(formData.get("is_active")) === "true";

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ical_sources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) back(error.message);

  revalidatePath(PATH);
}

export async function importIcal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const result = id
    ? await importIcalSource(id)
    : await importAllIcalSources().then((r) => ({ imported: r.imported, error: r.errors[0] ?? null }));

  // 取り込み結果は画面に出す。黙って0件だと、動いていないのか予定が無いのか分からない。
  revalidatePath(PATH);
  revalidatePath("/admin/blocked");
  revalidatePath("/admin/calendar");
  redirect(
    `${PATH}?${new URLSearchParams(
      result.error
        ? { error: `取り込みに失敗しました: ${result.error}` }
        : { done: `${result.imported}件の予定を取り込みました` },
    )}`,
  );
}

export async function syncIcalFromAnywhere(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/admin/calendar").trim() || "/admin/calendar";
  const result = await importAllIcalSources().then((r) => ({
    imported: r.imported,
    error: r.errors[0] ?? null,
  }));

  revalidatePath("/admin/ical");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/blocked");
  revalidatePath("/admin");

  const [path, query] = redirectTo.split("?");
  const sp = new URLSearchParams(query ?? "");
  if (result.error) {
    sp.set("error", `iCal同期エラー: ${result.error}`);
  } else {
    sp.set("done", `iCal同期完了: ${result.imported}件の外部予約ブロックを同期しました`);
  }

  redirect(`${path}?${sp.toString()}`);
}

