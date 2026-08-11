import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Customer } from "@/types/db";
import {
  createCustomer,
  updateCustomer,
  toggleBlacklist,
  deleteCustomer,
} from "./actions";
import { DeleteForm } from "../_components/DeleteForm";
import { SearchForm } from "./SearchForm";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const btnPrimary =
  "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700";

const fullName = (c: Customer) =>
  [c.last_name, c.first_name].filter(Boolean).join(" ") || "（名前未登録）";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = createAdminClient();
  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `last_name.ilike.${term},first_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }
  const { data } = await query;
  const customers = (data ?? []) as Customer[];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">顧客</h1>
          <p className="mt-1 text-sm text-gray-600">顧客の検索・登録・編集</p>
        </div>
        <SearchForm defaultValue={q ?? ""} />
      </header>

      <form
        action={createCustomer}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-5"
      >
        <input name="last_name" placeholder="姓" className={field} />
        <input name="first_name" placeholder="名" className={field} />
        <input name="email" type="email" placeholder="メール" className={field} />
        <input name="phone" placeholder="電話" className={field} />
        <SubmitButton className={btnPrimary}>顧客を追加</SubmitButton>
        <input name="note" placeholder="メモ（任意）" className={`${field} md:col-span-5`} />
      </form>

      <div className="space-y-3">
        {customers.length === 0 && (
          <p className="text-sm text-gray-500">
            {q ? "該当する顧客がいません。" : "顧客がまだいません。"}
          </p>
        )}
        {customers.map((c) => (
          <details
            key={c.id}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{fullName(c)}</span>
                {c.is_blacklisted && (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                    ブラックリスト
                  </span>
                )}
                {c.is_member && (
                  <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">
                    会員
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {c.email ?? "—"} / 来店 {c.visit_count}回
              </span>
            </summary>

            <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
              <form action={updateCustomer} className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <input type="hidden" name="id" value={c.id} />
                <input name="last_name" defaultValue={c.last_name ?? ""} placeholder="姓" className={field} />
                <input name="first_name" defaultValue={c.first_name ?? ""} placeholder="名" className={field} />
                <input name="email" type="email" defaultValue={c.email ?? ""} placeholder="メール" className={field} />
                <input name="phone" defaultValue={c.phone ?? ""} placeholder="電話" className={field} />
                <SubmitButton className={btnPrimary}>保存</SubmitButton>
                <input name="note" defaultValue={c.note ?? ""} placeholder="メモ" className={`${field} md:col-span-5`} />
              </form>

              <div className="flex flex-wrap items-end gap-2">
                <form action={toggleBlacklist} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="is_blacklisted" value={String(!c.is_blacklisted)} />
                  {!c.is_blacklisted && (
                    <input name="blacklist_reason" placeholder="理由（任意）" className={`${field} w-56`} />
                  )}
                  <SubmitButton className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-100">
                    {c.is_blacklisted ? "ブラックリスト解除" : "ブラックリストに追加"}
                  </SubmitButton>
                </form>
                <DeleteForm
                  action={deleteCustomer}
                  id={c.id}
                  confirmMessage={`${fullName(c)} を削除します。\n過去の予約は残りますが、予約者名は表示されなくなります。よろしいですか？`}
                />
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
