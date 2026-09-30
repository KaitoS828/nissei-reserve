import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 予約の個人情報を返すため、施設の管理者のみに限定する（/api は middleware の対象外）
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // PostgREST の or() 構文を壊す文字を除く
  const term = (new URL(request.url).searchParams.get("q") ?? "").replace(/[%,()*\\]/g, " ").trim();
  if (term.length < 1) return NextResponse.json({ reservations: [] });

  const db = createAdminClient();
  const like = `%${term}%`;
  const { data: customers } = await db
    .from("customers")
    .select("id")
    .or(`last_name.ilike.${like},first_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    .limit(50);
  const ids = (customers ?? []).map((c) => c.id);

  const cond = [`code.ilike.${like}`, ...(ids.length ? [`customer_id.in.(${ids.join(",")})`] : [])].join(",");
  const { data } = await db
    .from("reservations")
    .select("code, check_in, check_out, status, customers(last_name, first_name)")
    .or(cond)
    .is("archived_at", null)
    .order("check_in", { ascending: false })
    .limit(8);

  const reservations = (data ?? []).map((r) => {
    const c = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    return {
      code: r.code,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
      name: c ? [c.last_name, c.first_name].filter(Boolean).join(" ") : "",
    };
  });
  return NextResponse.json({ reservations });
}
