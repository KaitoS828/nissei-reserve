// 外部カレンダー（Airbnb / Booking.com / Googleカレンダー等）の予定を
// blocked_dates に取り込んで、自社サイトとの二重予約を防ぐ。
//
// 日付の扱いに注意が要る:
//  - iCal の終日予定の DTEND は「終了日を含まない」= 出発日。
//  - blocked_dates の end_date は availability.ts で両端を含む扱い。
//  そのまま入れると1泊ぶん余計に在庫を潰すので、1日戻して格納する。
//
// 取り込みは冪等にする。同じソースを2回走らせても増えないし、
// 外部側でキャンセルされた予定は次の取り込みで消える。

import { createAdminClient } from "./supabase/admin";

export type IcalEvent = {
  uid: string;
  summary: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD（iCal のまま＝終了日を含まない）
};

export type BlockedRange = { start_date: string; end_date: string };

/** このソース由来の blocked_dates を見分ける目印。名称変更に影響されないよう id を使う。 */
export function icalMarker(sourceId: string): string {
  return `[ical:${sourceId}]`;
}

function normalizeDate(value: string): string {
  const v = value.trim();
  // 20260801 / 20260801T150000 のどちらも先頭8桁が日付
  if (/^\d{8}/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return v.slice(0, 10);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** iCal の予定を blocked_dates の範囲に直す。DTEND が翌日以降なら1日戻す。 */
export function blockedRangeFromEvent(event: IcalEvent): BlockedRange | null {
  if (!event.start) return null;
  // 時刻付きの同日予定は DTEND を戻すと start より前になるので戻さない
  const end = event.end > event.start ? addDays(event.end, -1) : event.start;
  return { start_date: event.start, end_date: end };
}

export function parseIcal(text: string): IcalEvent[] {
  // 75オクテットで折り返された行を戻す（CRLF + 空白 or タブ が継続行）
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: IcalEvent[] = [];

  for (const raw of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const block = raw.split("END:VEVENT")[0] ?? "";
    const lines = block.split(/\r?\n/);
    const get = (name: string) => {
      const line = lines.find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
      return line?.split(":").slice(1).join(":").trim() ?? "";
    };

    const start = normalizeDate(get("DTSTART"));
    if (!start) continue;
    const rawEnd = get("DTEND");
    // DTEND が無い終日予定は1泊とみなす（DTSTART の翌日＝含まない終了日）
    const end = rawEnd ? normalizeDate(rawEnd) : addDays(start, 1);
    const summary = get("SUMMARY") || "外部カレンダー";
    events.push({ uid: get("UID") || `${start}-${summary}`, start, end, summary });
  }

  return events;
}

export type ImportResult = { imported: number; error: string | null };

export async function importIcalSource(sourceId: string): Promise<ImportResult> {
  const supabase = createAdminClient();
  const { data: source } = await supabase
    .from("ical_sources")
    .select("id, name, url, room_type_id, is_active")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || !source.is_active) return { imported: 0, error: "source_not_found" };

  const marker = icalMarker(sourceId);

  try {
    const res = await fetch(source.url as string, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // 外部サーバーが遅くても最大5秒でタイムアウト
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = parseIcal(await res.text())
      .map((event) => {
        const range = blockedRangeFromEvent(event);
        return range
          ? {
              room_type_id: source.room_type_id ?? null,
              start_date: range.start_date,
              end_date: range.end_date,
              reason: `${marker} ${event.summary}`,
              updated_at: new Date().toISOString(),
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // 取得に成功してから入れ替える。失敗時に既存のブロックを消さないための順序。
    await supabase.from("blocked_dates").delete().like("reason", `${marker}%`);
    if (rows.length) {
      const { error } = await supabase.from("blocked_dates").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("ical_sources")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", sourceId);
    await supabase
      .from("ical_import_logs")
      .insert({ ical_source_id: sourceId, status: "success", imported_count: rows.length });

    return { imported: rows.length, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "import_failed";
    await supabase
      .from("ical_import_logs")
      .insert({ ical_source_id: sourceId, status: "failed", imported_count: 0, error: message });
    return { imported: 0, error: message };
  }
}

export async function importAllIcalSources(): Promise<{ imported: number; errors: string[] }> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ical_sources").select("id").eq("is_active", true);

  const sources = (data ?? []) as { id: string }[];
  if (sources.length === 0) return { imported: 0, errors: [] };

  // 直列ではなく並列（Promise.allSettled）で全ソースを同時に高速取得
  const results = await Promise.allSettled(
    sources.map((s) => importIcalSource(s.id))
  );

  let imported = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      imported += r.value.imported;
      if (r.value.error) errors.push(r.value.error);
    } else {
      errors.push(r.reason?.message ?? "unknown_error");
    }
  }

  return { imported, errors };
}

