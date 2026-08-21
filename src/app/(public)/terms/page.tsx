import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">利用規約</h1>
        <p className="text-sm text-gray-500">最終改定日：2026年6月21日</p>
      </header>

      <p className="text-sm leading-7 text-gray-700">
        本利用規約（以下「本規約」）は、一棟貸し宿「日靜」（以下「当宿」）が運営する宿泊予約・決済サイト（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用いただいた方（以下「利用者」）は、本規約に同意したものとみなします。
      </p>

      <Section title="第1条（適用）">
        <p>本規約は、利用者と当宿との間の本サービスの利用に関わる一切の関係に適用されます。</p>
      </Section>

      <Section title="第2条（予約の成立）">
        <ul className="list-disc space-y-1 pl-5">
          <li>宿泊予約は、利用者が本サービス上で予約手続きを行い、クレジットカード決済が完了した時点で成立します。</li>
          <li>当宿が定める空室状況により、予約をお受けできない場合があります。</li>
          <li>当宿は1日1組限定の一棟貸しです。同一日程に複数組のご予約はお受けできません。</li>
        </ul>
      </Section>

      <Section title="第3条（料金・お支払い）">
        <ul className="list-disc space-y-1 pl-5">
          <li>宿泊料金は、プラン・人数・宿泊日数に基づき本サービス上に表示される金額とします。</li>
          <li>お支払いはクレジットカードによる事前決済のみとなります。カード情報の処理は決済代行事業者（Stripe, Inc.）が行い、当宿がカード番号を保持することはありません。</li>
        </ul>
      </Section>

      <Section title="第4条（チェックイン・チェックアウト）">
        <ul className="list-disc space-y-1 pl-5">
          <li>チェックイン：15:00 / チェックアウト：10:00</li>
          <li>時間の変更をご希望の場合は、事前に当宿までご連絡ください。</li>
        </ul>
      </Section>

      <Section title="第5条（キャンセル・返金）">
        <p>ご予約のキャンセルには、宿泊日からの日数に応じて以下のキャンセル料が発生します。返金額はキャンセル料を差し引いた金額となり、決済に使用したクレジットカードへ返金されます。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>宿泊日の7日前まで：無料（全額返金）</li>
          <li>宿泊日の3〜6日前：宿泊料金の50%</li>
          <li>宿泊日の2日前〜当日：宿泊料金の100%</li>
        </ul>
        <p className="mt-2 text-gray-500">
          キャンセルは、予約完了メールに記載の予約番号またはマイページから行えます。実際のキャンセル料・返金額は手続き画面でご確認いただけます。
        </p>
      </Section>

      <Section title="第6条（禁止事項）">
        <p>利用者は、本サービスの利用にあたり、次の行為をしてはなりません。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>法令または公序良俗に違反する行為</li>
          <li>虚偽の情報を登録する行為</li>
          <li>第三者になりすます行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>宿泊施設・設備を故意に損壊する行為</li>
        </ul>
      </Section>

      <Section title="第7条（免責事項）">
        <ul className="list-disc space-y-1 pl-5">
          <li>当宿は、天災・通信回線の障害など、当宿の責に帰すことができない事由により生じた損害について責任を負いません。</li>
          <li>本サービスの利用により利用者に生じた損害について、当宿に故意または重過失がある場合を除き、責任を負いません。</li>
        </ul>
      </Section>

      <Section title="第8条（規約の変更）">
        <p>当宿は、必要と判断した場合、利用者に通知することなく本規約を変更できるものとします。変更後の規約は、本サービス上に掲載した時点から効力を生じます。</p>
      </Section>

      <Section title="第9条（準拠法・管轄）">
        <p>本規約の解釈には日本法を準拠法とし、本サービスに関して紛争が生じた場合には、当宿の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
      </Section>

      <OperatorInfo />
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2 text-sm leading-7 text-gray-700">{children}</div>
    </section>
  );
}

function OperatorInfo() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
      <h2 className="mb-2 text-base font-semibold text-gray-900">事業者情報</h2>
      <dl className="space-y-1">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">名称</dt><dd>一棟貸し宿「日靜」</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">所在地</dt><dd>〒089-2771 北海道広尾郡広尾町音調津733番地</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">連絡先</dt><dd><a href="tel:07012516275" className="text-teal-700 underline">070-1251-6275</a></dd></div>
      </dl>
    </section>
  );
}
