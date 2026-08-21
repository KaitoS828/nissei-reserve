import type { Metadata } from "next";
import Link from "next/link";
import { SITE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "よくある質問",
  description: `${SITE.name}のご予約・ご宿泊に関するよくある質問。チェックイン時間、キャンセル料、駐車場、ペット可否などをまとめています。`,
  alternates: { canonical: `${siteUrl()}/faq` },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "チェックイン・チェックアウトの時間は？",
    a: `チェックインは${SITE.checkIn}、チェックアウトは${SITE.checkOut}です。当宿はスタッフ対応なしの事前チェックイン制で、ご予約時にご案内するドアコードで玄関を解錠していただきます。`,
  },
  {
    q: "何名まで宿泊できますか？",
    a: `一棟貸し・1日1組限定で、最大${SITE.maxGuests}名までご利用いただけます。`,
  },
  {
    q: "駐車場はありますか？",
    a: "敷地内に無料の駐車場をご用意しています。",
  },
  {
    q: "ペットは連れて行けますか？",
    a: "申し訳ございませんが、ペットの同伴は承っておりません。",
  },
  {
    q: "喫煙はできますか？",
    a: "館内は禁煙です。喫煙は屋外の指定された場所でお願いいたします。",
  },
  {
    q: "サウナは貸切利用できますか？",
    a: "専用の薪サウナ「KOBU SAUNA」を、宿泊のお客様だけで貸切利用いただけます。日帰りでのサウナ利用プランもございます。",
  },
  {
    q: "キャンセル料はいつからかかりますか？",
    a: "チェックイン7日前まではキャンセル料無料です。3〜6日前は宿泊料金の50%、チェックイン当日〜2日前は全額（100%）のキャンセル料がかかります。",
  },
  {
    q: "予約の確認・キャンセルはどこから行えますか？",
    a: "予約番号とメールアドレスがあれば、予約照会ページからいつでも内容確認とキャンセル手続きができます。",
  },
  {
    q: "支払い方法は何がありますか？",
    a: "クレジットカードによるオンライン事前決済のみです（Stripeが決済処理を行い、当宿がカード番号を保持することはありません）。",
  },
];

export default function FaqPage() {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">よくある質問</h1>
        <p className="text-sm text-gray-500">
          {SITE.name}のご予約・ご宿泊に関するよくあるご質問です。
        </p>
      </header>

      <div className="space-y-6">
        {FAQS.map((f) => (
          <section key={f.q} className="rounded-2xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900">Q. {f.q}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-700">A. {f.a}</p>
          </section>
        ))}
      </div>

      <p className="text-sm text-gray-600">
        ここに無いご質問は、お電話（
        <a href={`tel:${SITE.phone}`} className="text-teal-700 underline">
          {SITE.phone}
        </a>
        ）またはメール（
        <a href={`mailto:${SITE.email}`} className="text-teal-700 underline">
          {SITE.email}
        </a>
        ）よりお気軽にご連絡ください。
        <Link href="/reserve" className="ml-1 text-teal-700 underline">
          ご予約はこちら
        </Link>
      </p>
    </article>
  );
}
