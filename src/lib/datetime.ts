// DBの timestamptz は UTC で入っている。そのまま切り出して表示すると
// お客様に9時間ずれた時刻を見せることになるため、必ず日本時間に直す。

/** ISO文字列を「YYYY-MM-DD HH:mm」の日本時間表記にする。 */
export function jstStamp(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}
