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

export async function saveBaseMonthlyCosts(formData: FormData) {
  const supabase = createAdminClient();

  const yearMonth = String(formData.get("year_month") ?? "").trim();
  const currentYear = yearMonth.slice(0, 4);
  const currentMonth = yearMonth.slice(5, 7);
  const queryParam = `year=${currentYear}&month=${currentMonth}`;

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    redirectError("年月は YYYY-MM 形式で入力してください", queryParam);
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
      if (amount === 0 && !formData.has(`keep_zero_${item.key}`)) {
        // 0円が明示的に入力された場合は更新、空ならスキップ
        await supabase
          .from("operating_costs")
          .update({ amount, updated_at: new Date().toISOString() })
          .eq("id", existingId);
      } else {
        await supabase
          .from("operating_costs")
          .update({ amount, updated_at: new Date().toISOString() })
          .eq("id", existingId);
      }
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
    summary: `${yearMonth} のベース費用（家賃・電気・ガス・水道）を保存`,
  }).catch(() => {});

  revalidatePath(PATH);
  redirect(`${PATH}?year=${currentYear}&month=${currentMonth}&done=${encodeURIComponent(`${yearMonth} のベース費用を保存しました`)}`);
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

export async function archiveReservationFromAnalytics(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? id);
  const excludeReason = String(formData.get("exclude_reason") ?? "").trim() || null;
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const queryParam = year ? `year=${year}${month ? `&month=${month}` : ""}` : "";

  if (!id) redirectError("対象の予約IDが指定されていません", queryParam);

  const { error } = await supabase
    .from("reservations")
    .update({
      archived_at: new Date().toISOString(),
      ...(excludeReason ? { cancel_reason: excludeReason } : {}),
    })
    .eq("id", id);

  if (error) {
    redirectError(`集計からの除外に失敗しました: ${error.message}`, queryParam);
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
  redirect(`${PATH}?${queryParam}&done=${encodeURIComponent(`予約 ${code} を集計から除外しました`)}`);
}

export async function unarchiveReservationFromAnalytics(formData: FormData) {
  const supabase = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? id);
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const queryParam = year ? `year=${year}${month ? `&month=${month}` : ""}` : "";

  if (!id) redirectError("対象の予約IDが指定されていません", queryParam);

  const { error } = await supabase
    .from("reservations")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    redirectError(`集計への復元に失敗しました: ${error.message}`, queryParam);
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
  redirect(`${PATH}?${queryParam}&done=${encodeURIComponent(`予約 ${code} を集計対象に復元しました`)}`);
}


