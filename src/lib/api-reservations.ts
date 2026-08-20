import { createAdminClient } from "@/lib/supabase/admin";

const SELECT =
  "code, check_in, check_out, nights, num_guests, amount, status, payment_status, note, " +
  "customers(last_name, first_name, email, phone), plans(name)";

export type ApiReservation = {
  code: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  numGuests: number;
  amount: number;
  status: string;
  paymentStatus: string;
  note: string | null;
  plan: string | null;
  customer: { lastName: string | null; firstName: string | null; email: string | null; phone: string | null } | null;
};

function toApi(row: Record<string, unknown>): ApiReservation {
  const c = row.customers as { last_name: string | null; first_name: string | null; email: string | null; phone: string | null } | null;
  const p = row.plans as { name: string } | null;
  return {
    code: row.code as string,
    checkIn: row.check_in as string,
    checkOut: row.check_out as string,
    nights: row.nights as number,
    numGuests: row.num_guests as number,
    amount: row.amount as number,
    status: row.status as string,
    paymentStatus: row.payment_status as string,
    note: (row.note as string | null) ?? null,
    plan: p?.name ?? null,
    customer: c
      ? { lastName: c.last_name, firstName: c.first_name, email: c.email, phone: c.phone }
      : null,
  };
}

export async function getReservationByCode(code: string): Promise<ApiReservation | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("reservations").select(SELECT).eq("code", code).maybeSingle();
  if (!data) return null;
  return toApi(data as unknown as Record<string, unknown>);
}

export async function listReservations(opts: {
  scope?: "today" | "upcoming" | "all";
  query?: string | null;
}): Promise<ApiReservation[]> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from("reservations").select(SELECT);
  if (opts.scope === "today") {
    q = q.or(`check_in.eq.${today},check_out.eq.${today}`);
  } else if (!opts.scope || opts.scope === "upcoming") {
    q = q.gte("check_in", today).in("status", ["pending", "confirmed"]);
  }
  q = q.order("check_in").limit(50);
  const { data } = await q;
  let rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (opts.query) {
    const t = opts.query.toLowerCase();
    rows = rows.filter((r) => {
      const c = r.customers as { last_name?: string; first_name?: string; email?: string } | null;
      const name = `${c?.last_name ?? ""}${c?.first_name ?? ""}`.toLowerCase();
      return String(r.code).toLowerCase().includes(t) || name.includes(t) || (c?.email ?? "").toLowerCase().includes(t);
    });
  }
  return rows.map(toApi);
}
