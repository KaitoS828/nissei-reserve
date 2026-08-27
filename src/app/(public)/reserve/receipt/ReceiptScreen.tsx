import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { dict, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { PrintButton } from "./PrintButton";

type ReceiptResv = {
  code: string; check_in: string; check_out: string; nights: number;
  amount: number; payment_status: string; created_at: string; receipt_name: string | null;
  customers: { last_name: string | null; first_name: string | null } | null;
  plans: { name: string } | null;
  payments: { stripe_payment_intent_id: string | null; created_at: string }[] | null;
};

const TAX_RATE = 0.1;

/** 税込金額から税抜・消費税額を出す（1円未満切り捨て）。 */
function splitTax(amountIncludingTax: number): { taxable: number; tax: number } {
  const taxable = Math.floor(amountIncludingTax / (1 + TAX_RATE));
  return { taxable, tax: amountIncludingTax - taxable };
}

/** 住所の先頭が「〒XXX-XXXX」なら郵便番号と残りの住所に分ける（4段表示用）。 */
function splitPostal(address: string | null | undefined): { postal: string | null; rest: string } {
  if (!address) return { postal: null, rest: "" };
  const m = address.match(/^(〒\d{3}-?\d{4})\s*(.*)$/);
  return m ? { postal: m[1], rest: m[2] } : { postal: null, rest: address };
}

// 日英で同じ中身を出すための画面本体。
// 日本語は「領収書」の体裁、英語は receipt として読める体裁にする。
export async function ReceiptScreen({
  code,
  token,
  locale,
}: {
  code?: string;
  token?: string;
  locale: Locale;
}) {
  const t = dict(locale).receipt;
  const c = dict(locale).common;
  const supabase = createAdminClient();

  let resv: ReceiptResv | null = null;
  if (code && token) {
    const { data } = await supabase
      .from("reservations")
      .select(
        "code, check_in, check_out, nights, amount, payment_status, created_at, receipt_name, customers(last_name, first_name), plans(name), payments(stripe_payment_intent_id, created_at)",
      )
      .eq("code", code)
      .eq("lookup_token", token)
      .maybeSingle();
    resv = (data as unknown as ReceiptResv) ?? null;
  }
  const { data: facility } = await supabase.from("facility").select("name, address, phone").limit(1).single();

  if (!resv) {
    return <p className="text-sm text-gray-500">{t.cannotShow}</p>;
  }
  if (resv.payment_status !== "paid") {
    return <p className="text-sm text-gray-500">{t.notPaidYet}</p>;
  }

  const guestName = [resv.customers?.last_name, resv.customers?.first_name].filter(Boolean).join(" ") || t.fallbackName;
  const displayName = resv.receipt_name?.trim() || guestName;
  const honorificName = t.honorific(displayName);
  const issued = new Date(resv.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "ja-JP");
  const { taxable, tax } = splitTax(resv.amount);
  const latestPayment = [...(resv.payments ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const paymentMethodLabel = latestPayment?.stripe_payment_intent_id
    ? t.paymentMethodCard
    : t.paymentMethodOther;

  const itemLabel = t.itemName(resv.plans?.name ?? "—");
  const cellBorder = "border border-gray-900 px-2 py-1";
  const { postal, rest: addressRest } = splitPostal(
    locale === "en" ? SITE.address.fullEn : facility?.address,
  );
  // 単価は実際の請求額から逆算する（長期割引等があっても表の合計欄は必ず実際の請求額と一致させる）
  const unitPrice = resv.nights > 0 ? Math.round(resv.amount / resv.nights) : resv.amount;

  return (
    <div className="mx-auto max-w-2xl print:mx-0 print:max-w-none">
      <div className="flex justify-end print:hidden">
        <PrintButton label={t.print} />
      </div>

      {/* 角丸なし・罫線ベースの業務用フォーマット。印刷時はA4いっぱいに広げ、
          施設情報をページ下端に固定して末尾の無駄な余白を作らない
          （@pageの用紙サイズ・余白はglobals.cssで指定。297mmから上下15mmずつを引いた高さ） */}
      <div className="printable mt-6 border border-gray-900 bg-white p-8 print:mt-0 print:min-h-[267mm] print:w-full">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-widest text-gray-900">{t.title}</h1>
          <div>
            <table className="ml-auto text-xs text-gray-700">
              <tbody>
                <tr>
                  <td className="pr-4 text-gray-500">{t.issuedLabel}</td>
                  <td>{issued}</td>
                </tr>
                <tr>
                  <td className="pr-4 text-gray-500">{t.no}</td>
                  <td className="font-mono">{resv.code}</td>
                </tr>
              </tbody>
            </table>

            {/* 発行者情報。印鑑は回転なしで宛名ブロックの右端にわずかに重なる程度 */}
            <div className="mt-3 flex items-start justify-end gap-2">
              <div className="text-right text-base text-gray-700">
                <p className="text-lg font-semibold text-gray-900">{facility?.name}</p>
                {postal && <p>{postal}</p>}
                <p>{addressRest}</p>
                <p>{facility?.phone}</p>
              </div>
              <Image
                src="/receipt-stamp.png"
                alt=""
                width={90}
                height={90}
                className="shrink-0"
              />
            </div>
          </div>
        </div>

        <div className="mt-16 border-b border-gray-900 pb-1">
          <span className="text-lg text-gray-900">{honorificName}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="border border-gray-900 px-3 py-1.5 text-sm font-semibold text-gray-900">
            {t.amount}
          </span>
          <span className="text-3xl font-bold text-gray-900">¥{resv.amount.toLocaleString()}-</span>
        </div>

        <p className="mt-4 text-sm text-gray-700">{t.forStay(resv.plans?.name ?? "—")}</p>

        <table className="mt-6 w-full border-collapse text-sm text-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className={cellBorder}>{t.itemCol}</th>
              <th className={`${cellBorder} w-16`}>{t.qtyCol}</th>
              <th className={`${cellBorder} w-16`}>{t.unitCol}</th>
              <th className={`${cellBorder} w-28 text-right`}>{t.unitPriceCol}</th>
              <th className={`${cellBorder} w-28 text-right`}>{t.amountCol}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cellBorder}>{itemLabel}</td>
              <td className={`${cellBorder} text-center`}>{resv.nights}</td>
              <td className={`${cellBorder} text-center`}>{c.nights}</td>
              <td className={`${cellBorder} text-right`}>¥{unitPrice.toLocaleString()}</td>
              <td className={`${cellBorder} text-right`}>¥{resv.amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2 flex justify-end">
          <table className="border-collapse text-sm text-gray-800">
            <tbody>
              <tr>
                <td className={`${cellBorder} bg-gray-50 text-gray-600`}>{t.subtotal}</td>
                <td className={`${cellBorder} w-28 text-right`}>¥{taxable.toLocaleString()}</td>
              </tr>
              <tr>
                <td className={`${cellBorder} bg-gray-50 text-gray-600`}>
                  {t.taxRow}
                  <span className="ml-1 text-xs text-gray-400">({t.taxRateNote})</span>
                </td>
                <td className={`${cellBorder} text-right`}>¥{tax.toLocaleString()}</td>
              </tr>
              <tr>
                <td className={`${cellBorder} bg-gray-50 font-semibold text-gray-900`}>{t.total}</td>
                <td className={`${cellBorder} text-right font-semibold`}>¥{resv.amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-500">{t.received}</p>

        <div className="mt-8 border border-gray-900 p-3 text-xs text-gray-700">
          <p className="mb-1.5 font-semibold text-gray-900">{t.notes}</p>
          <p>{c.reservationCode}: {resv.code}</p>
          <p>{t.stayDates}: {dict(locale).cancel.dateRange(resv.check_in, resv.check_out, resv.nights)}</p>
          <p>{t.paymentMethod}: {paymentMethodLabel}</p>
        </div>
      </div>
    </div>
  );
}
