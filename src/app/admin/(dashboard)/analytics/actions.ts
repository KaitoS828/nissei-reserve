"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/analytics";

function redirectError(msg: string, params?: { year?: string; month?: string }): never {
  const sp = new URLSearchParams();
  if (params?.year) sp.set("year", params.year);
  if (params?.month) sp.set("month", params.month);
  sp.set("error", msg);
  redirect(`${PATH}?${sp.toString()}`);
}

function redirectDone(msg: string, params?: { year?: string; month?: string }): never {
  const sp = new URLSearchParams();
  if (params?.year) sp.set("year", params.year);
  if (params?.month) sp.set("month", params.month);
  sp.set("done", msg);
  redirect(`${PATH}?${sp.toString()}`);
}

export async function saveBaseMonthlyCosts(formData: FormData) {
  const supabase = createAdminClient();

  const yearMonth = String(formData.get("year_month") ?? "").trim();
  const currentYear = yearMonth.slice(0, 4);
  const currentMonth = yearMonth.slice(5, 7);
  const paramObj = { year: currentYear, month: currentMonth };

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", paramObj);
  }

  const baseItems: { category: string; key: string }[] = [
    { category: "家賃", key: "rent" },
    { category: "電気代", key: "electricity" },
    { category: "ガス代", key: "gas" },
    { category: "水道代", key: "water" },
    { category: "Wi-Fi通信費", key: "wifi" },
  ];

  // 既存の同一年月かつベースカテゴリのレコードを取得
  const { data: existing } = await supabase
    .from("operating_costs")
    .select("id, category")
    .eq("year_month", yearMonth)
    .in("category", baseItems.map((b) => b.category));

  const existingMap = new Map((existing ?? []).map((e) => [e.category, e.id]));

  for (const item of baseItems) {
    const rawVal = formData.get(item.key);
    if (rawVal === null || String(rawVal).trim() === "") continue;
    const amount = Number(rawVal);
    if (isNaN(amount) || amount < 0) continue;

    const existingId = existingMap.get(item.category);
    if (existingId) {
      await supabase
        .from("operating_costs")
        .update({ amount, updated_at: new Date().toISOString() })
        .eq("id", existingId);
    } else if (amount > 0 || String(rawVal).trim() !== "") {
      await supabase.from("operating_costs").insert({
        year_month: yearMonth,
        category: item.category,
        amount,
        description: `毎月の固定・インフラ費用（${item.category}）`,
      });
    }
  }

  await auditLog(supabase, {
    action: "operating_cost_base_save",
    entityType: "operating_cost",
    entityId: yearMonth,
    summary: `${yearMonth} のベース費用（家賃・電気・ガス・水道・Wi-Fi）を保存`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirectDone(`${yearMonth} のベース費用を保存しました`, paramObj);
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
  const paramObj = { year: currentYear, month: currentMonth };

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", paramObj);
  }
  if (isNaN(amount) || amount < 0) {
    redirectError("金額は0以上の数値を入力してください", paramObj);
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
    redirectError(`コストの登録に失敗しました: ${error.message}`, paramObj);
  }

  await auditLog(supabase, {
    action: "operating_cost_create",
    entityType: "operating_cost",
    entityId: data.id,
    summary: `${yearMonth} の経費「${category}」¥${amount.toLocaleString()} を登録`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirectDone("コストを登録しました", paramObj);
}

export async function createBulkOperatingCosts(formData: FormData) {
  const supabase = createAdminClient();

  const rawItems = String(formData.get("items_json") ?? "").trim();
  const fallbackYearMonth = String(formData.get("year_month") ?? "").trim();

  let items: Array<{
    year_month?: string;
    category?: string;
    amount?: number | string;
    description?: string | null;
    recorded_date?: string | null;
  }> = [];

  try {
    items = JSON.parse(rawItems);
  } catch {
    redirectError("入力データの形式が不正です");
  }

  const validRows = items
    .map((item) => {
      const ym = (item.year_month || fallbackYearMonth).trim();
      const cat = (item.category ?? "").trim() || "その他経費";
      const amt = Number(item.amount);
      const desc = (item.description ?? "").trim() || null;
      const recDate = (item.recorded_date ?? "").trim() || null;
      return {
        year_month: ym,
        category: cat,
        amount: amt,
        description: desc,
        recorded_date: recDate,
      };
    })
    .filter((row) => /^\d{4}-\d{2}$/.test(row.year_month) && !isNaN(row.amount) && row.amount > 0);

  const targetYm = validRows[0]?.year_month || fallbackYearMonth;
  const currentYear = targetYm ? targetYm.slice(0, 4) : undefined;
  const currentMonth = targetYm ? targetYm.slice(5, 7) : undefined;
  const paramObj = { year: currentYear, month: currentMonth };

  if (validRows.length === 0) {
    redirectError("登録する経費（金額が1円以上）を1件以上入力してください", paramObj);
  }

  const { error } = await supabase
    .from("operating_costs")
    .insert(validRows)
    .select("id");

  if (error) {
    redirectError(`一括登録に失敗しました: ${error.message}`, paramObj);
  }

  const totalAmount = validRows.reduce((s, r) => s + r.amount, 0);

  await auditLog(supabase, {
    action: "operating_cost_bulk_create",
    entityType: "operating_cost",
    entityId: "bulk",
    summary: `${validRows.length}件の経費を一括登録（合計 ¥${totalAmount.toLocaleString()}）`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirectDone(`${validRows.length}件の経費をまとめて登録しました（合計: ¥${totalAmount.toLocaleString()}）`, paramObj);
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
  const paramObj = { year: currentYear, month: currentMonth };

  if (!id) redirectError("対象のコストIDが指定されていません", paramObj);
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", paramObj);
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
    redirectError(`コストの更新に失敗しました: ${error.message}`, paramObj);
  }

  await auditLog(supabase, {
    action: "operating_cost_update",
    entityType: "operating_cost",
    entityId: id,
    summary: `${yearMonth} の経費「${category}」¥${amount.toLocaleString()} を更新`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirectDone("コストを更新しました", paramObj);
}

export async function deleteOperatingCost(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const paramObj = { year: year || undefined, month: month || undefined };

  if (!id) redirectError("対象のコストIDが指定されていません", paramObj);

  const { error } = await supabase
    .from("operating_costs")
    .delete()
    .eq("id", id);

  if (error) {
    redirectError(`コストの削除に失敗しました: ${error.message}`, paramObj);
  }

  await auditLog(supabase, {
    action: "operating_cost_delete",
    entityType: "operating_cost",
    entityId: id,
    summary: `経費ID ${id} を削除`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirectDone("コストを削除しました", paramObj);
}

export async function archiveReservationFromAnalytics(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? id);
  const excludeReason = String(formData.get("exclude_reason") ?? "").trim() || null;
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const paramObj = { year: year || undefined, month: month || undefined };

  if (!id) redirectError("対象の予約IDが指定されていません", paramObj);

  const { error } = await supabase
    .from("reservations")
    .update({
      archived_at: new Date().toISOString(),
      ...(excludeReason ? { cancel_reason: excludeReason } : {}),
    })
    .eq("id", id);

  if (error) {
    redirectError(`集計からの除外に失敗しました: ${error.message}`, paramObj);
  }

  await auditLog(supabase, {
    action: "reservation.archive",
    entityType: "reservations",
    entityId: id,
    summary: `予約 ${code} を集計から除外（理由: ${excludeReason ?? "未指定"}）`,
  }).catch(() => {});

  revalidatePath(PATH);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/calendar");
  redirectDone(`予約 ${code} を集計から除外しました`, paramObj);
}

export async function unarchiveReservationFromAnalytics(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? id);
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const paramObj = { year: year || undefined, month: month || undefined };

  if (!id) redirectError("対象の予約IDが指定されていません", paramObj);

  const { error } = await supabase
    .from("reservations")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    redirectError(`集計への復元に失敗しました: ${error.message}`, paramObj);
  }

  await auditLog(supabase, {
    action: "reservation.unarchive",
    entityType: "reservations",
    entityId: id,
    summary: `予約 ${code} を集計に対象として復元`,
  }).catch(() => {});

  revalidatePath(PATH);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/calendar");
  redirectDone(`予約 ${code} を集計対象に復元しました`, paramObj);
}
