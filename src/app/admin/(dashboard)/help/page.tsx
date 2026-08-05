import Link from "next/link";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    title: "📊 ダッシュボード",
    items: [
      "ログイン直後のトップ画面。本日のチェックイン/アウト・売上・未対応問合せをひと目で確認できます。",
      "「予定しているチェックイン」に今後の予約が日付順で並びます。",
    ],
  },
  {
    title: "🗓 予約カレンダー",
    items: [
      "月表示で各日の予約と空き室数を確認できます。前月/翌月で移動。",
      "満室の日は赤、本日はシアンの枠で表示されます。",
    ],
  },
  {
    title: "📝 予約リスト",
    items: [
      "予約の一覧・検索・新規登録（電話/メール予約の手入力）ができます。",
      "各予約からステータス変更（確定→チェックイン→チェックアウト等）・客室割当・削除が可能。",
      "ステータスのフィルタ（仮予約/確定/キャンセル など）で絞り込めます。",
    ],
  },
  {
    title: "🚫 予約不可（休業日）",
    items: [
      "休業日・メンテナンス日を期間で設定します。",
      "設定した期間は公開サイトのカレンダーで自動的に「満室・予約不可」になります。",
    ],
  },
  {
    title: "👤 顧客",
    items: [
      "顧客の検索・登録・編集ができます。",
      "ブラックリスト登録（理由付き）で要注意の顧客を管理できます。",
    ],
  },
  {
    title: "💳 決済",
    items: [
      "Stripeのカード決済履歴を確認できます。",
      "予約のキャンセルや管理者からの返金（全額/一部）ができます。返金はStripeを通じて自動処理されます。",
    ],
  },
  {
    title: "📈 集計・分析",
    items: [
      "総予約数・確定売上・キャンセル率・延べ宿泊数を確認。",
      "月別売上グラフ・予約ステータスの内訳を表示します。",
    ],
  },
  {
    title: "🌐 公開予約サイト（お客様側）",
    items: [
      "お客様は /reserve からカレンダーで日程を選び、プラン選択→情報入力→Stripe決済で予約します。",
      "予約確定時、お客様に確認メール・オーナーにメール/Slack通知が自動送信されます。",
      "お客様はマイページ（会員）または予約照会から、予約確認・キャンセル（返金）ができます。",
    ],
  },
  {
    title: "🔔 通知について",
    items: [
      "メール（Resend）: 予約確定・キャンセルをお客様とオーナーへ送信。",
      "Slack: 新規予約・キャンセルをオーナーのワークスペースへ通知。",
      "Googleカレンダー: 予約確定でイベント自動登録、キャンセルで削除。",
    ],
  },
];

const FAQ = [
  {
    q: "予約が入ったらどう分かりますか？",
    a: "ダッシュボードの「予定しているチェックイン」に表示され、同時にオーナー宛のメールとSlackに通知が届きます。",
  },
  {
    q: "電話で受けた予約を登録したい",
    a: "「予約リスト」→「＋ 新規予約を登録」から、客室タイプ・日程・人数を入力して登録できます。",
  },
  {
    q: "特定の日を予約できないようにしたい",
    a: "「予約不可」ページで期間を設定すると、公開カレンダーでその日がグレー（予約不可）になります。",
  },
  {
    q: "お客様の予約をキャンセル・返金したい",
    a: "「決済」ページから対象の決済を選んで返金（全額/一部）できます。返金はStripe経由で自動処理されます。",
  },
  {
    q: "料金やプランを変更したい",
    a: "「客室タイプ」「宿泊プラン」で基本料金・プラン内容を編集できます。長期割引はプランごとに設定されています。",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">使い方・FAQ</h1>
        <p className="mt-1 text-sm text-gray-600">
          nissei予約システムの管理画面ガイド
        </p>
      </header>

      {/* 機能ガイド */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">機能ガイド</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-2 font-medium text-cyan-700">{s.title}</h3>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-600">•</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">よくある質問</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <details key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
              <summary className="cursor-pointer font-medium text-gray-900">Q. {f.q}</summary>
              <p className="mt-2 text-sm text-gray-700">A. {f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <p>
          お困りの際は、開発者までお問い合わせください。公開サイトは{" "}
          <Link href="/reserve" className="text-cyan-700 hover:underline">こちら</Link> から確認できます。
        </p>
      </section>
    </div>
  );
}
