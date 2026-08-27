import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_COLORS, resolveBrandColor } from "@/lib/brand-colors";
import { updateBrandColor } from "./actions";

export const dynamic = "force-dynamic";

export default async function CustomizePage() {
  const supabase = createAdminClient();
  const { data: facility } = await supabase.from("facility").select("settings").limit(1).maybeSingle();
  const current = resolveBrandColor((facility?.settings as Record<string, unknown> | null)?.brand_color);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-bold tracking-widest text-gray-900">カスタマイズ</h1>
        <p className="mt-1 text-xs text-gray-500">
          予約サイトのボタンなどに使うアクセントカラーを選べます。選ぶとすぐに予約TOPページへ反映されます。
        </p>
      </div>

      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-4 text-sm font-medium text-gray-900">アクセントカラー</p>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {(Object.entries(BRAND_COLORS) as [keyof typeof BRAND_COLORS, (typeof BRAND_COLORS)[keyof typeof BRAND_COLORS]][]).map(
            ([key, { label, shades }]) => (
              <form key={key} action={updateBrandColor}>
                <input type="hidden" name="brand_color" value={key} />
                <button
                  type="submit"
                  title={label}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition ${
                    current === key ? "border-gray-900" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <span
                    className="h-10 w-10 rounded-full"
                    style={{ backgroundColor: shades[600] }}
                  />
                </button>
                <p className="mt-1 text-center text-[11px] text-gray-500">{label}</p>
              </form>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
