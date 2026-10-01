"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

const PATH = "/admin/lodging-tax";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function back(f: FormData, key: "done" | "error", msg: string): never {
  const sp = new URLSearchParams();
  for (const k of ["y", "p", "incl"]) {
    const v = text(f, `ctx_${k}`);
    if (v) sp.set(k, v);
  }
  sp.set(key, msg);
  redirect(`${PATH}?${sp.toString()}`);
}

export async function saveLodgingTaxSettings(formData: FormData) {
  const designation = text(formData, "designation_no").replace(/[\s-]/g, "");
  const corporate = text(formData, "corporate_no").replace(/[\s-]/g, "");
  if (designation && !/^\d{12}$/.test(designation)) back(formData, "error", "指定番号は12桁の数字で入力してください");
  if (corporate && !/^\d{12,13}$/.test(corporate)) back(formData, "error", "個人番号又は法人番号は、13桁（個人番号は12桁）の数字で入力してください");

  const supabase = createAdminClient();
  const { error } = await supabase.from("lodging_tax_settings").upsert({
    id: 1,
    designation_no: designation || null,
    operator_address: text(formData, "operator_address") || null,
    operator_name: text(formData, "operator_name") || null,
    corporate_no: corporate || null,
    facility_address: text(formData, "facility_address") || null,
    facility_name: text(formData, "facility_name") || null,
    updated_at: new Date().toISOString(),
  });
  if (error) back(formData, "error", `保存に失敗しました: ${error.message}`);

  await auditLog(supabase, {
    action: "lodging_tax_settings_save",
    entityType: "lodging_tax_settings",
    entityId: "1",
    summary: "宿泊税の特別徴収義務者情報を保存",
  }).catch(() => {});
  revalidatePath(PATH);
  back(formData, "done", "登録情報を保存しました");
}

export async function saveLodgingTaxFiling(formData: FormData) {
  const periodStart = text(formData, "period_start");
  if (!/^\d{4}-\d{2}-01$/.test(periodStart)) back(formData, "error", "対象期間が不正です");
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(text(formData, k)) ? text(formData, k) : null);
  const amountRaw = text(formData, "amount");
  const amount = amountRaw === "" ? null : Math.trunc(Number(amountRaw));
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) back(formData, "error", "納入額は0以上の数字で入力してください");
  const method = ["eltax", "mail", "visit"].includes(text(formData, "method")) ? text(formData, "method") : null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("lodging_tax_filings").upsert(
    {
      period_start: periodStart,
      filed_on: date("filed_on"),
      paid_on: date("paid_on"),
      amount,
      method,
      note: text(formData, "note") || null,
    },
    { onConflict: "period_start" },
  );
  if (error) back(formData, "error", `保存に失敗しました: ${error.message}`);

  await auditLog(supabase, {
    action: "lodging_tax_filing_save",
    entityType: "lodging_tax_filings",
    entityId: periodStart,
    summary: `宿泊税の申告・納入の記録を保存（${periodStart}〜）`,
  }).catch(() => {});
  revalidatePath(PATH);
  revalidatePath("/admin");
  back(formData, "done", "申告・納入の記録を保存しました");
}
