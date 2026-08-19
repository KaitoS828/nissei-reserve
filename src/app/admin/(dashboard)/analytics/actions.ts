"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/analytics";

function redirectError(msg: string, query = ""): never {
  const q = query ? `&${query}` : "";
  redirect(`${PATH}?error=${encodeURIComponent(msg)}${q}`);
}

export async function createOperatingCost(formData: FormData) {
  const supabase = createAdminClient();

  const yearMonth = String(formData.get("year_month") ?? "").trim();
  const category = String(formData.get("category") ?? "その他").trim() || "その他";
  const amount = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "").trim() || null;
  const recordedDate = String(formData.get("recorded_date") ?? "").trim() || null;

  const currentYear = yearMonth.slice(0, 4);
  const currentMonth = yearMonth.slice(5, 7);
  const queryParam = `year=${currentYear}&month=${currentMonth}`;

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", queryParam);
  }
  if (isNaN(amount) || amount < 0) {
    redirectError("金額は0以上の数値を入力してください", queryParam);
  }

  const { data, error } = await supabase
    .from("operating_costs")
    .insert({
      year_month: yearMonth,
      category,
      amount,
      description,
      recorded_date: recordedDate,
    })
    .select("id")
    .single();

  if (error) {
    redirectError(`コストの登録に失敗しました: ${error.message}`, queryParam);
  }

  await auditLog(supabase, {
    action: "operating_cost_create",
    entityType: "operating_cost",
    entityId: data.id,
    summary: `${yearMonth} の経費「${category}」¥${amount.toLocaleString()} を登録`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirect(`${PATH}?year=${currentYear}&month=${currentMonth}&done=${encodeURIComponent("コストを登録しました")}`);
}

export async function updateOperatingCost(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("year_month") ?? "").trim();
  const category = String(formData.get("category") ?? "その他").trim() || "その他";
  const amount = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "").trim() || null;
  const recordedDate = String(formData.get("recorded_date") ?? "").trim() || null;

  const currentYear = yearMonth.slice(0, 4);
  const currentMonth = yearMonth.slice(5, 7);
  const queryParam = `year=${currentYear}&month=${currentMonth}`;

  if (!id) redirectError("対象のコストIDが指定されていません", queryParam);
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", queryParam);
  }

  const { error } = await supabase
    .from("operating_costs")
    .update({
      year_month: yearMonth,
      category,
      amount,
      description,
      recorded_date: recordedDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectError(`コストの更新に失敗しました: ${error.message}`, queryParam);
  }

  await auditLog(supabase, {
    action: "operating_cost_update",
    entityType: "operating_cost",
    entityId: id,
    summary: `${yearMonth} の経費「${category}」¥${amount.toLocaleString()} を更新`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirect(`${PATH}?year=${currentYear}&month=${currentMonth}&done=${encodeURIComponent("コストを更新しました")}`);
}

export async function deleteOperatingCost(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const queryParam = year ? `year=${year}${month ? `&month=${month}` : ""}` : "";

  if (!id) redirectError("対象のコストIDが指定されていません", queryParam);

  const { error } = await supabase
    .from("operating_costs")
    .delete()
    .eq("id", id);

  if (error) {
    redirectError(`コストの削除に失敗しました: ${error.message}`, queryParam);
  }

  await auditLog(supabase, {
    action: "operating_cost_delete",
    entityType: "operating_cost",
    entityId: id,
    summary: `経費ID ${id} を削除`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirect(`${PATH}?${queryParam}&done=${encodeURIComponent("コストを削除しました")}`);
}
