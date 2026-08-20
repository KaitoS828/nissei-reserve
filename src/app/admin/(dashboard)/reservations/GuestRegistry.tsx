import { genderLabel } from "@/lib/guests";

export type RegistryGuest = {
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
};

// 旅館業法上の記録なので、書いてある内容がそのまま確認できることを優先する。
export function GuestRegistry({
  guests,
  numGuests,
}: {
  guests: RegistryGuest[];
  numGuests: number;
}) {
  const complete = guests.length >= numGuests;

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-800">
        宿泊者名簿{" "}
        <span className={complete ? "text-emerald-700" : "text-amber-700"}>
          {guests.length} / {numGuests} 名{complete ? "（記入済み）" : "（未記入あり）"}
        </span>
      </summary>

      <div className="space-y-3 border-t border-gray-200 p-4">
        {guests.length === 0 && (
          <p className="text-xs text-gray-500">
            まだご記入がありません。予約時メールのフォームからご記入いただけます。
          </p>
        )}

        {guests.map((g) => (
          <div key={g.guest_order} className="rounded border border-gray-200 bg-white p-3 text-sm">
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
                  <div>旅券番号: <span className="font-mono text-gray-900">{g.passport_number ?? "—"}</span></div>
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
    </details>
  );
}
