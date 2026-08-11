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
