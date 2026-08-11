import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Room, RoomType } from "@/types/db";
import { createRoom, updateRoom, toggleRoomActive, deleteRoom } from "./actions";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";
const btnPrimary =
  "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700";

export default async function RoomsPage() {
  const supabase = createAdminClient();
  const [{ data: roomData }, { data: typeData }] = await Promise.all([
    supabase.from("rooms").select("*").order("name", { ascending: true }),
    supabase.from("room_types").select("*").order("sort_order"),
  ]);
  const rooms = (roomData ?? []) as Room[];
  const types = (typeData ?? []) as RoomType[];
  const typeName = (id: string | null) =>
    types.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">客室</h1>
        <p className="mt-1 text-sm text-gray-600">
          客室（号室）と所属する客室タイプの登録
        </p>
      </header>

      {types.length === 0 ? (
        <p className="text-sm text-amber-700">
          先に「客室タイプ」を登録してください。
        </p>
      ) : (
        <form
          action={createRoom}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-4"
        >
          <input name="name" placeholder="号室（例: 101）" required className={field} />
          <select name="room_type_id" required className={`${field} md:col-span-2`}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <SubmitButton className={btnPrimary}>追加</SubmitButton>
        </form>
      )}

      <div className="space-y-3">
        {rooms.length === 0 && (
          <p className="text-sm text-gray-500">客室がまだありません。</p>
        )}
        {rooms.map((room) => (
          <details
            key={room.id}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{room.name}</span>
                {!room.is_active && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    無効
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {typeName(room.room_type_id)}
              </span>
            </summary>

            <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
              <form action={updateRoom} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input type="hidden" name="id" value={room.id} />
                <input name="name" defaultValue={room.name} required className={field} />
                <select
                  name="room_type_id"
                  defaultValue={room.room_type_id ?? ""}
                  className={`${field} md:col-span-2`}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className={btnPrimary}>保存</SubmitButton>
              </form>

              <div className="flex gap-2">
                <form action={toggleRoomActive}>
                  <input type="hidden" name="id" value={room.id} />
                  <input type="hidden" name="is_active" value={String(!room.is_active)} />
                  <SubmitButton className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">
                    {room.is_active ? "無効化" : "有効化"}
                  </SubmitButton>
                </form>
                <form action={deleteRoom}>
                  <input type="hidden" name="id" value={room.id} />
                  <SubmitButton className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-100">
                    削除
                  </SubmitButton>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
