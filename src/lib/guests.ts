// 宿泊者名簿の表示まわり。クライアントからも読むので、
// node の crypto や Supabase クライアントに依存させないこと。

export const GENDERS = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
] as const;

export function genderLabel(gender: string | null): string {
  if (!gender) return "未回答";
  return GENDERS.find((g) => g.value === gender)?.label ?? "その他";
}

/** 「1990/1/5」「1990-01-05」「19900105」を YYYY-MM-DD にする。空欄は ""、解釈できなければ null。 */
export function parseBirthDate(input: string): string | null {
  const v = input.trim().replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  if (!v) return "";
  const m = v.match(/^(\d{4})[/\-.年]?(\d{1,2})[/\-.月]?(\d{1,2})日?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
