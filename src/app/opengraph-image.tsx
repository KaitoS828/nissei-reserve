import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoBuffer = readFileSync(join(process.cwd(), "public/logo.png"));
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  const fontData = readFileSync(join(process.cwd(), "src/assets/fonts/NotoSansJP-Bold.ttf"));

  const supabase = createAdminClient();
  const { data: facility } = await supabase.from("facility").select("settings").limit(1).maybeSingle();
  const settings = (facility?.settings as { hero_images?: unknown } | null) ?? null;
  const heroImages = Array.isArray(settings?.hero_images) ? (settings!.hero_images as string[]) : [];
  const bgImage = heroImages[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#111827",
        }}
      >
        {bgImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage}
            width={1200}
            height={630}
            style={{ position: "absolute", inset: 0, objectFit: "cover", opacity: 0.5 }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.25))",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 64,
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoBase64} width={64} height={64} style={{ borderRadius: 999 }} />
            <span style={{ fontSize: 26, color: "#e5e7eb", letterSpacing: 4 }}>
              PRIVATE VILLA &amp; SAUNA
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#ffffff" }}>
            {SITE.name}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#e5e7eb", marginTop: 16 }}>
            {SITE.tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Sans JP", data: fontData, style: "normal", weight: 700 }],
    },
  );
}
