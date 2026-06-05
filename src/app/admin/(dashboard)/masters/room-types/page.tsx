import { createAdminClient } from "@/lib/supabase/admin";
import type { RoomType } from "@/types/db";
import {
  createRoomType,
  updateRoomType,
  toggleRoomTypeActive,
  deleteRoomType,
} from "./actions";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";
const btnPrimary =
  "rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-950 transition hover:bg-cyan-400";

export default async function RoomTypesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("room_types")
    .select("*")
    .order("sort_order", { ascending: true });
  const roomTypes = (data ?? []) as RoomType[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">客室タイプ</h1>
        <p className="mt-1 text-sm text-gray-400">
          客室タイプ（定員・基本料金）の登録・編集
        </p>
      </header>

      {/* 新規登録 */}
      <form
        action={createRoomType}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-5 md:grid-cols-6"
      >
        <input name="name" placeholder="名称" required className={`${field} md:col-span-2`} />
        <input name="capacity" type="number" min={1} defaultValue={2} placeholder="定員" className={field} />
        <input name="base_price" type="number" min={0} defaultValue={0} placeholder="基本料金(円)" className={field} />
        <input name="sort_order" type="number" defaultValue={0} placeholder="表示順" className={field} />
        <button className={btnPrimary}>追加</button>
        <input name="description" placeholder="説明（任意）" className={`${field} md:col-span-6`} />
      </form>

      {/* 一覧 */}
      <div className="space-y-3">
        {roomTypes.length === 0 && (
          <p className="text-sm text-gray-500">客室タイプがまだありません。</p>
        )}
        {roomTypes.map((rt) => (
          <details
            key={rt.id}
            className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span className="font-medium text-white">{rt.name}</span>
                {!rt.is_active && (
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    無効
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-400">
                定員 {rt.capacity}名 / ¥{rt.base_price.toLocaleString()}
              </span>
            </summary>

            <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
              <form
                action={updateRoomType}
                className="grid grid-cols-1 gap-3 md:grid-cols-6"
              >
                <input type="hidden" name="id" value={rt.id} />
                <input name="name" defaultValue={rt.name} required className={`${field} md:col-span-2`} />
                <input name="capacity" type="number" min={1} defaultValue={rt.capacity} className={field} />
                <input name="base_price" type="number" min={0} defaultValue={rt.base_price} className={field} />
                <input name="sort_order" type="number" defaultValue={rt.sort_order} className={field} />
                <button className={btnPrimary}>保存</button>
                <input name="description" defaultValue={rt.description ?? ""} placeholder="説明" className={`${field} md:col-span-6`} />
              </form>

              <div className="flex gap-2">
                <form action={toggleRoomTypeActive}>
                  <input type="hidden" name="id" value={rt.id} />
                  <input type="hidden" name="is_active" value={String(!rt.is_active)} />
                  <button className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-800">
                    {rt.is_active ? "無効化" : "有効化"}
                  </button>
                </form>
                <form action={deleteRoomType}>
                  <input type="hidden" name="id" value={rt.id} />
                  <button className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40">
                    削除
                  </button>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
