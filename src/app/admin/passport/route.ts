import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedPassportUrl } from "@/lib/passport-storage";

// 旅券画像は非公開バケットに置いてあるので、その都度の署名付きURLに転送する。
// /admin 配下なので middleware の管理者チェックが効く。
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path が必要です" }, { status: 400 });

  const supabase = createAdminClient();

  // バケット内の任意のパスを引ける状態にしない。名簿に登録された画像だけ通す。
  const { data: owner } = await supabase
    .from("reservation_guests")
    .select("id")
    .eq("passport_image_url", path)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  const url = await signedPassportUrl(supabase, path);
  if (!url) return NextResponse.json({ error: "URLを作成できませんでした" }, { status: 500 });

  return NextResponse.redirect(url);
}
