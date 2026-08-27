// 公開サイトのアクセントカラー(ボタン等)のプリセット。管理画面「カスタマイズ」から選択し、
// facility.settings.brand_color に保存する。値はTailwind公式パレットをそのまま採用。

export type BrandColorKey =
  | "teal"
  | "orange"
  | "emerald"
  | "sky"
  | "rose"
  | "amber"
  | "violet"
  | "slate";

export type BrandShades = {
  50: string;
  100: string;
  200: string;
  500: string;
  600: string;
  700: string;
  800: string;
};

export const BRAND_COLORS: Record<BrandColorKey, { label: string; shades: BrandShades }> = {
  teal: {
    label: "ティール",
    shades: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59" },
  },
  orange: {
    label: "オレンジ（焚き火）",
    shades: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412" },
  },
  emerald: {
    label: "エメラルド",
    shades: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46" },
  },
  sky: {
    label: "スカイブルー",
    shades: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985" },
  },
  rose: {
    label: "ローズ",
    shades: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239" },
  },
  amber: {
    label: "アンバー",
    shades: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
  },
  violet: {
    label: "バイオレット",
    shades: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6" },
  },
  slate: {
    label: "スレート",
    shades: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b" },
  },
};

export const DEFAULT_BRAND_COLOR: BrandColorKey = "teal";

export function isBrandColorKey(value: unknown): value is BrandColorKey {
  return typeof value === "string" && value in BRAND_COLORS;
}

export function resolveBrandColor(value: unknown): BrandColorKey {
  return isBrandColorKey(value) ? value : DEFAULT_BRAND_COLOR;
}

export function brandColorCssVars(key: BrandColorKey): string {
  const shades = BRAND_COLORS[key].shades;
  return Object.entries(shades)
    .map(([step, hex]) => `--brand-${step}:${hex};`)
    .join("");
}
