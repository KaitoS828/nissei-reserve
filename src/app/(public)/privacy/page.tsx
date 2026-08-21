import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
        <p className="text-sm text-gray-500">最終改定日：2026年6月21日</p>
      </header>

      <p className="text-sm leading-7 text-gray-700">
        一棟貸し宿「日靜」（以下「当宿」）は、宿泊予約・決済サイト（以下「本サービス」）における利用者の個人情報を、以下の方針に基づき適切に取り扱います。
      </p>

      <Section title="1. 取得する情報">
        <p>当宿は、ご予約および宿泊サービスの提供のため、次の情報を取得します。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>氏名・フリガナ</li>
          <li>住所・電話番号・メールアドレス</li>
          <li>宿泊日程・人数・プランなどの予約内容</li>
          <li>お支払いに関する情報（カード番号は当宿では保持しません。下記5をご覧ください）</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>宿泊予約の受付・確認・変更・キャンセルの対応</li>
          <li>宿泊料金の決済および返金処理</li>
          <li>予約確認メール等、ご予約に関する連絡</li>
          <li>宿泊者名簿の作成など、旅館業法等の法令に基づく対応</li>
          <li>お問い合わせへの対応</li>
        </ul>
      </Section>

      <Section title="3. 第三者提供">
        <p>
          当宿は、法令に基づく場合を除き、ご本人の同意なく個人情報を第三者に提供しません。ただし、本サービスの提供に必要な範囲で、以下の外部サービスに情報を委託・連携します。
        </p>
      </Section>

      <Section title="4. 外部サービスの利用">
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium text-gray-900">Stripe, Inc.</span>（決済処理）：クレジットカード決済のため、お支払い情報を処理します。</li>
          <li><span className="font-medium text-gray-900">Google（Google カレンダー）</span>：予約状況の管理のため、予約情報を連携します。</li>
          <li><span className="font-medium text-gray-900">Resend</span>：予約確認メール等の送信のため、氏名・メールアドレスを利用します。</li>
          <li><span className="font-medium text-gray-900">Supabase</span>：予約・顧客データの保管に利用します。</li>
        </ul>
      </Section>

      <Section title="5. クレジットカード情報の取り扱い">
        <p>
          クレジットカード情報は、決済代行事業者である Stripe, Inc. が直接取得・処理します。当宿のサーバーがカード番号・有効期限・セキュリティコードを保持・記録することはありません。
        </p>
      </Section>

      <Section title="6. アクセス解析ツール">
        <p>
          本サービスでは、利用状況の把握のため Google Analytics を利用する場合があります。これらはCookieを使用しますが、個人を特定する情報は含まれません。
        </p>
      </Section>

      <Section title="7. 保管期間">
        <p>
          取得した個人情報は、利用目的の達成に必要な期間、および法令で定められた期間保管し、その後は適切に削除または廃棄します。
        </p>
      </Section>

      <Section title="8. 開示・訂正・削除のご請求">
        <p>
          ご本人からの個人情報の開示・訂正・利用停止・削除のご請求があった場合は、ご本人であることを確認のうえ、合理的な範囲で速やかに対応します。下記の連絡先までお問い合わせください。
        </p>
      </Section>

      <Section title="9. ポリシーの変更">
        <p>
          当宿は、必要に応じて本ポリシーを変更することがあります。変更後の内容は、本サービス上に掲載した時点から効力を生じます。
        </p>
      </Section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        <h2 className="mb-2 text-base font-semibold text-gray-900">お問い合わせ窓口</h2>
        <dl className="space-y-1">
          <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">名称</dt><dd>一棟貸し宿「日靜」</dd></div>
          <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">所在地</dt><dd>〒089-2771 北海道広尾郡広尾町音調津733番地</dd></div>
          <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">連絡先</dt><dd><a href="tel:07012516275" className="text-teal-700 underline">070-1251-6275</a></dd></div>
        </dl>
      </section>
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
