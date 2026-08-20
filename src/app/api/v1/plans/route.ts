import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 公開・認証不要（PIIを含まない）
export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("plans")
    .select("id, name, description, tags, gallery_images, plan_prices(price_per_night, guest_prices)")
    .eq("is_active", true)
    .order("sort_order");

  type Row = {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    gallery_images: string[];
    plan_prices: { price_per_night: number; guest_prices: Record<string, number> | null }[];
  };

  const plans = ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    tags: p.tags,
    pricePerNight: p.plan_prices?.[0]?.price_per_night ?? null,
    guestPrices: p.plan_prices?.[0]?.guest_prices ?? null,
    galleryImages: p.gallery_images ?? [],
  }));

  return NextResponse.json({ plans });
}
