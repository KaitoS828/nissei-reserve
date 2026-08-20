import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが指定されていません" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const supabase = createAdminClient();

    // public-media バケットが存在しない場合は自動作成を試みる
    try {
      await supabase.storage.createBucket("public-media", { public: true });
    } catch {
      // 既に存在する場合は無視
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `site-builder/${Date.now()}_${cleanName}`;

    const { data, error } = await supabase.storage
      .from("public-media")
      .upload(fileName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      // フォールバック: データURI
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${base64}`;
      return NextResponse.json({ url: dataUrl });
    }

    const { data: publicUrlData } = supabase.storage.from("public-media").getPublicUrl(data.path);
    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (err: unknown) {
    console.error("Upload handler error:", err);
    const message = err instanceof Error ? err.message : "アップロードに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
