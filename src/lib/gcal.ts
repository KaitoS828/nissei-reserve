// GAS Webアプリ経由で Googleカレンダーに予約を反映。
// 未設定・失敗しても予約フローを止めない。

type CreatePayload = {
  action: "create";
  code: string; customer?: string; email?: string; phone?: string; plan?: string;
  check_in: string; check_out: string; guests?: number; amount?: number;
};
type DeletePayload = { action: "delete"; event_id: string };

async function callGas(payload: CreatePayload | DeletePayload): Promise<{ event_id?: string } | null> {
  const url = process.env.GAS_WEBAPP_URL;
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url || !secret) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { event_id?: string };
  } catch {
    return null;
  }
}

// 予約をカレンダーに作成し、作成された event_id を返す
export async function gcalCreateEvent(p: Omit<CreatePayload, "action">): Promise<string | null> {
  const r = await callGas({ action: "create", ...p });
  return r?.event_id ?? null;
}

// カレンダーの予約イベントを削除
export async function gcalDeleteEvent(eventId: string): Promise<void> {
  await callGas({ action: "delete", event_id: eventId });
}
