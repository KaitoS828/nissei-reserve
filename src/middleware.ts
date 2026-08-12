import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // セッションを必ずリフレッシュ（getUser は毎回サーバ検証）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login";
  // 2段階認証の入力画面は aal1 のまま通す。そうしないと入力に辿り着けない。
  const isMfa = pathname === "/admin/mfa";

  if (isAdmin && !isLogin) {
    // IP 制限（ADMIN_ALLOWED_IPS 設定時のみ）
    const allow = (process.env.ADMIN_ALLOWED_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length > 0) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
      if (!allow.includes(ip)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    // 未ログインはログインへ
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // 2段階認証。TOTPを登録済みなら aal2 まで昇格していないと通さない。
    // 未登録のユーザーは nextLevel が aal1 のままなので、影響を受けない。
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

    if (isMfa) {
      // 済んでいる／不要なのに入力画面に来たら管理画面へ戻す
      if (!needsMfa) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
      return response;
    }

    if (needsMfa) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/mfa";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // 本部ロールは個人情報を含まない /admin/hq のみ許可。
    const role = user.app_metadata?.role;
    const isHq = pathname.startsWith("/admin/hq");
    if (isHq) {
      if (!["admin", "hq_admin"].includes(String(role))) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      return response;
    }

    // 宿管理画面は施設オペレーション担当のみ。
    if (role !== "admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
