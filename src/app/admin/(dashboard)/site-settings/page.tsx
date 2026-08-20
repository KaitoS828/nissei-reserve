import { createAdminClient } from "@/lib/supabase/admin";
import { VisualSiteBuilder } from "./VisualSiteBuilder";

export const dynamic = "force-dynamic";

type FacilitySettings = {
  hero_title?: string;
  hero_sub?: string;
  hero_description?: string;
  hero_images?: unknown;
  features?: unknown;
};

export default async function SiteSettingsPage() {
  const supabase = createAdminClient();

  const [{ data: facility }, { data: plansData }] = await Promise.all([
    supabase.from("facility").select("*").limit(1).maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, long_description, tags, gallery_images, plan_prices(price_per_night)")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const settings = (facility?.settings as FacilitySettings) ?? {};
  const heroTitle = settings.hero_title ?? "日靜 — ご宿泊予約";
  const heroSub = settings.hero_sub ?? "PRIVATE VILLA & SAUNA";
  const heroDescription =
    settings.hero_description ??
    "北海道広尾町の自然と静寂に包まれた、1日1組限定の完全プライベート空間。\n専用の薪サウナ「KOBU SAUNA」とともに、特別なご滞在をお愉しみください。";

  const heroImages = Array.isArray(settings.hero_images) ? (settings.hero_images as string[]) : [];

  const features = Array.isArray(settings.features)
    ? (settings.features as string[])
    : ["プライベートサウナ", "一棟貸し", "オンライン決済", "事前チェックイン"];

  type PlanRow = {
    id: string;
    name: string;
    long_description: string | null;
    tags: string[] | null;
    gallery_images: string[] | null;
    plan_prices: { price_per_night: number }[];
  };

  const plans = ((plansData ?? []) as unknown as PlanRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.long_description ?? "",
    tags: p.tags ?? [],
    price: p.plan_prices?.[0]?.price_per_night ?? 0,
    galleryImages: p.gallery_images ?? [],
  }));

  const initialData = {
    name: facility?.name ?? "日靜",
    phone: facility?.phone ?? "",
    address: facility?.address ?? "",
    heroTitle,
    heroSub,
    heroDescription,
    heroImages,
    features,
    plans,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-bold tracking-widest text-gray-900">
          ビジュアルサイトビルダー
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          テキストの編集や画像のアップロードをプレビューを見ながらリアルタイムで行えます。「保存して本番に反映」で即座に予約TOPページへ適用されます。
        </p>
      </div>

      <VisualSiteBuilder initialData={initialData} />
    </div>
  );
}
