import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { genderLabel } from "@/lib/guests";

export const dynamic = "force-dynamic";

const field =
  "rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-600";

type GuestRow = {
  id: string;
  reservation_id: string;
  guest_order: number;
  full_name: string;
  furigana: string | null;
  address: string | null;
  contact: string | null;
  occupation: string | null;
  gender: string | null;
  birth_date: string | null;
  is_foreign_national: boolean;
  nationality: string | null;
  passport_number: string | null;
  passport_image_url: string | null;
  reservations: {
    code: string;
    check_in: string;
    check_out: string;
    num_guests: number;
    status: string;
  } | null;
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { q, from, to } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("reservation_guests")
    .select(
      "id, reservation_id, guest_order, full_name, furigana, address, contact, occupation, gender, birth_date, is_foreign_national, nationality, passport_number, passport_image_url, reservations(code, check_in, check_out, num_guests, status)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (q) query = query.or(`full_name.ilike.%${q}%,furigana.ilike.%${q}%`);

  const { data } = await query;
  let guests = (data ?? []) as unknown as GuestRow[];

  // 宿泊日での絞り込みは埋め込み先の値を見るので、取得後に行う
  if (from) guests = guests.filter((g) => (g.reservations?.check_in ?? "") >= from);
  if (to) guests = guests.filter((g) => (g.reservations?.check_in ?? "") <= to);

  // 予約ごとにまとめる。名簿は「誰がいつ泊まったか」の単位で見るため。
  const stays = new Map<string, GuestRow[]>();
  for (const g of guests) {
    const list = stays.get(g.reservation_id) ?? [];
    list.push(g);
    stays.set(g.reservation_id, list);
  }
  const ordered = [...stays.entries()].sort(
    (a, b) => (b[1][0].reservations?.check_in ?? "").localeCompare(a[1][0].reservations?.check_in ?? ""),
  );

  const foreignCount = guests.filter((g) => g.is_foreign_national).length;
  const missingPassport = guests.filter((g) => g.is_foreign_national && !g.passport_image_url).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">宿泊者名簿</h1>
        <p className="mt-1 text-sm text-gray-600">
          旅館業法にもとづく宿泊者の記録です。ご記入は予約時メールのフォームから行われます。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "記録件数", value: `${guests.length}名` },
          { label: "宿泊数", value: `${ordered.length}件` },
          { label: "国内に住所なし", value: `${foreignCount}名` },
          { label: "旅券の写し未提出", value: `${missingPassport}名`, warn: missingPassport > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`mt-1 text-lg font-semibold ${s.warn ? "text-amber-700" : "text-gray-900"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">お名前</span>
          <input name="q" defaultValue={q ?? ""} placeholder="氏名の一部" className={field} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">宿泊日（開始）</span>
          <input type="date" name="from" defaultValue={from ?? ""} className={field} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-gray-600">宿泊日（終了）</span>
          <input type="date" name="to" defaultValue={to ?? ""} className={field} />
        </label>
        <button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
          絞り込む
        </button>
        {(q || from || to) && (
          <Link href="/admin/guests" className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">
            条件をクリア
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">CSVで書き出す</div>
        <a
          href={`/admin/export/guests${from || to ? `?from=${from ?? ""}&to=${to ?? ""}` : ""}`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          {from || to ? "いまの絞り込みを書き出す" : "全件を書き出す"}
        </a>
        <form method="get" action="/admin/export/guests" className="flex items-end gap-2">
          <label className="space-y-1">
            <span className="block text-xs text-gray-600">月を指定</span>
            <input type="month" name="month" required className={field} />
          </label>
          <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100">
            その月を書き出す
          </button>
        </form>
      </div>

      {ordered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          該当する記録がありません。
        </p>
      )}

      <div className="space-y-3">
        {ordered.map(([reservationId, list]) => {
          const r = list[0].reservations;
          const complete = r ? list.length >= r.num_guests : true;
          return (
            <div key={reservationId} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <span className="flex items-center gap-3 text-sm">
                  <span className="font-medium tabular-nums text-gray-900">
                    {r?.check_in} → {r?.check_out}
                  </span>
                  <span className="font-mono text-xs text-gray-400">{r?.code}</span>
                </span>
                <span className={`text-xs ${complete ? "text-emerald-700" : "text-amber-700"}`}>
                  {list.length} / {r?.num_guests ?? list.length} 名
                  {complete ? "（記入済み）" : "（未記入あり）"}
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {list
                  .sort((a, b) => a.guest_order - b.guest_order)
                  .map((g) => (
                    <div key={g.id} className="rounded border border-gray-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {g.guest_order}人目
                        </span>
                        <span className="font-medium text-gray-900">{g.full_name}</span>
                        {g.furigana && (
                          <span className="text-xs text-gray-500">（{g.furigana}）</span>
                        )}
                        {g.is_foreign_national && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                            国内に住所なし
                          </span>
                        )}
                      </div>

                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
                        <div>住所: <span className="text-gray-900">{g.address ?? "—"}</span></div>
                        <div>連絡先: <span className="text-gray-900">{g.contact ?? "—"}</span></div>
                        <div>職業: <span className="text-gray-900">{g.occupation ?? "—"}</span></div>
                        <div>
                          生年月日: <span className="text-gray-900">{g.birth_date ?? "—"}</span>
                          <span className="ml-2">性別: {genderLabel(g.gender)}</span>
                        </div>
                        {g.is_foreign_national && (
                          <>
                            <div>国籍: <span className="text-gray-900">{g.nationality ?? "—"}</span></div>
                            <div>
                              旅券番号: <span className="font-mono text-gray-900">{g.passport_number ?? "—"}</span>
                            </div>
                          </>
                        )}
                      </dl>

                      {g.is_foreign_national && (
                        <div className="mt-2">
                          {g.passport_image_url ? (
                            <a
                              href={`/admin/passport?path=${encodeURIComponent(g.passport_image_url)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded border border-cyan-300 px-2 py-1 text-xs text-cyan-700 hover:bg-cyan-50"
                            >
                              旅券の写しを開く
                            </a>
                          ) : (
                            <span className="text-xs text-amber-700">旅券の写しが未提出です</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
