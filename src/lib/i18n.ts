// 日英の文言。日本語を既定とし、英語は /en 配下の別URLで出す。
// 同じURLで切り替えるだけだと Google が英語版を別ページとして扱わず、
// 英語圏からの検索流入が取れないため、URLを分ける。

import type { ReservationStatus } from "@/types/db";

export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(v: string | undefined): v is Locale {
  return v === "ja" || v === "en";
}

/** 同じ内容の相手言語URL。切替リンクと hreflang の両方で使う。 */
export function altPath(pathname: string, to: Locale): string {
  const bare = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return to === "en" ? (bare === "/" ? "/en" : `/en${bare}`) : bare;
}

// 英語版があるパス（配下も含む）。無いパスへ /en を付けると 404 になるので、
// 切替リンクとナビゲーションはここを見て出し分ける。
// 英語ページを追加したらここに足す。
const EN_PREFIXES = ["/reserve", "/checkin", "/register"];

/** このパスに英語版があるか。/en 付き・無しのどちらを渡してもよい。 */
export function hasEnglishVersion(pathname: string): boolean {
  const bare = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (bare === "/") return true;
  return EN_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`));
}

/** 自言語のURL。リンク先を組み立てるときに使う。 */
export function localePath(locale: Locale, path: string): string {
  return locale === "en" ? (path === "/" ? "/en" : `/en${path}`) : path;
}

/** pathname から今の言語を読む。クライアント側で locale を渡さずに済ませる用。 */
export function localeOf(pathname: string): Locale {
  return /^\/en(\/|$)/.test(pathname) ? "en" : "ja";
}

// タグとアメニティはマスタ由来の定型語で、宿の文章ではない。
// ここで訳しておくと、DBを触らずに英語ページの中身が英語になる。
// 知らない語はそのまま出す（訳が無いことを隠さない）。
const TERMS_EN: Record<string, string> = {
  "1棟貸し": "Whole house",
  禁煙: "Non-smoking",
  長期割: "Long-stay discount",
  日帰り: "Day use",
  無料WiFi: "Free Wi-Fi",
  "無料Wi-Fi": "Free Wi-Fi",
  洗浄機付トイレ: "Washlet toilet",
  エアコン: "Air conditioning",
  冷蔵庫: "Refrigerator",
  電気ポット: "Electric kettle",
  "コーヒーメーカー/お茶セット": "Coffee maker and tea set",
  ドライヤー: "Hair dryer",
  洗濯機: "Washing machine",
  乾燥機: "Clothes dryer",
  電子レンジ: "Microwave",
  バス: "Bathtub",
  トイレ: "Toilet",
  タオル: "Towels",
  バスタオル: "Bath towels",
  ボディーソープ: "Body soap",
  シャンプー: "Shampoo",
  コンディショナー: "Conditioner",
  ハミガキセット: "Toothbrush set",
  スリッパ: "Slippers",
  敷地内無料駐車場: "Free on-site parking",
  キッチン: "Kitchen",
  貸切サウナ: "Private sauna",
  // キャンセル理由。DB には日本語のまま保存し、表示だけ訳す
  予定が変わった: "My plans changed",
  体調不良: "Illness",
  "天候・交通の都合": "Weather or transport",
  "料金・プランの変更希望": "I want to change the plan or rate",
  その他: "Other",
};

/** タグ・アメニティなど定型語の訳。訳が無ければ元の語をそのまま返す。 */
export function term(locale: Locale, value: string): string {
  return locale === "en" ? (TERMS_EN[value] ?? value) : value;
}

type Dict = {
  site: { name: string; about: string; terms: string; privacy: string; faq: string };
  nav: { reserve: string; lookup: string; checkin: string; account: string; login: string };
  reserve: {
    location: string; contact: string; noPlans: string;
    prevYear: string; prevMonth: string; nextMonth: string; nextYear: string;
    monthLabel: (year: number, month0: number) => string;
    weekdays: string[];
    tapToSelect: string; checkingAvailability: string;
    legendSelected: string; legendAvailable: string; legendFull: string;
    in: string; out: string; nightCount: (n: number) => string;
    guestsLabel: string; guestOption: (n: number) => string; guestsUpTo: (n: number) => string; clear: string;
    roomLabel: string;
    guestRangeNote: (min: number, max: number) => string;
    perPersonFrom: (yen: string) => string;
    minGuestsNotice: (n: number) => string; minGuestsBadge: (n: number) => string;
    nightsTaxIncl: (n: number) => string;
    perPersonTotal: (amount: string) => string;
    longStayApplied: (pct: number) => string;
    oneNightTotal: (guests: number, yen: string) => string;
    bookTheseDates: string; selectDates: string;
  };
  plan: {
    backHome: string; checkIn: string; checkOut: string;
    guestsRange: (min: number, max: number) => string;
    checkAvailability: string; full: string; book: string;
    available: string;
    aboutPlan: string; aboutRoom: string; roomFeatures: string; features: string[];
    amenities: string; longStay: string;
    discountLine: (min: number, max: number | null, pct: number) => string;
    contentInJapanese: string;
  };
  common: {
    reservationCode: string; email: string; guests: string; nights: string;
    plan: string; dates: string; submit: string; back: string; loading: string;
    required: string; optional: string; switchLang: string;
  };
  status: Record<ReservationStatus, string>;
  form: {
    back: string; taxIncl: string;
    summary: (from: string, to: string, nights: number, guests: number) => string;
    name: string; lastName: string; firstName: string;
    nameKana: string; lastNameKana: string; firstNameKana: string;
    email: string; emailConfirm: string; phone: string; phonePlaceholder: string;
    prefecture: string; city: string; address: string; building: string;
    prefecturePlaceholder: string; cityPlaceholder: string;
    addressPlaceholder: string; buildingPlaceholder: string;
    addressHint: string;
    checkInTime: string;
    survey: string; surveyPlaceholder: string;
    contact: string; contactPlaceholder: string;
    agreePolicy: { before: string; linkText: string; after: string };
    submit: string; submitting: string;
    errors: Record<string, string>;
    errMinGuests: (n: number) => string;
  };
  complete: {
    title: string; lead: string; notFound: string;
    amount: string; statusLabel: string; paid: string; pending: string;
    guideTitle: string; guideCode: string;
    // リンクを文中に挟むので、前後の文に分けて持つ
    guideAccount: { before: string; after: string };
    guideEmail: string;
    guideDoor: { before: string; after: string };
    guidePhone: string;
    home: string; viewBooking: string; receipt: string;
  };
  lookup: {
    title: string; cancelled: string; codePlaceholder: string;
    emailLabel: string; search: string; notFound: string;
    doorCode: string; validBetween: (from: string, to: string) => string;
    doNotShare: string; notIssuedYet: string;
    policy: string; requestCancel: string;
  };
  cancel: {
    title: string; notFound: string; backToLookup: string; alreadyCancelled: string; home: string;
    paidAmount: string; refundAmount: string;
    dateRange: (from: string, to: string, nights: number) => string;
    refundNote: (days: number, pct: number, fee: string) => string;
    reason: string; detail: string; detailPlaceholder: string;
    irreversible: string; back: string; confirm: string; confirming: string;
    doneTitle: string; doneLead: string; refunded: string;
    errors: Record<string, string>;
  };
  email: {
    brand: string; footer: string;
    honorific: (name: string) => string;
    cancelSubject: (code: string) => string;
    cancelLead: (code: string) => string;
    refundLabel: string;
    cancelClosing: string;
  };
  receipt: {
    print: string; title: string; issuedOn: (d: string) => string;
    honorific: (name: string) => string; amount: string;
    forStay: (plan: string) => string; stayDates: string;
    received: string; cannotShow: string; notPaidYet: string; fallbackName: string;
  };
  checkin: {
    title: string; lead: string; showCode: string; verifying: string;
    doorCode: string; validBetween: string; howToOpen: string; doNotShare: string;
    notFound: string; cancelled: string; checkedOut: string; unpaid: string; noShow: string;
    notIssued: string; contactUs: string; doCheckin: string; checkedIn: string;
    arrivalNote: string; tooMany: string;
  };
  register: {
    title: string; lead: string; status: string; person: string; representative: string;
    fullName: string; furigana: string; furiganaHint: string;
    address: string; addressHint: string; contact: string; contactHint: string;
    occupation: string; birthDate: string; gender: string; noAnswer: string;
    male: string; female: string; other: string;
    foreign: string; foreignNote: string; nationality: string; passportNo: string;
    passportImage: string; passportImageHint: string; alreadyUploaded: string;
    addNext: string; submitAll: string; editLater: string;
    invalidUrl: string; done: string;
    errName: string; errAddress: string; errContact: string; errContactFormat: string;
    errBirth: string; errNationality: string; errPassportNo: string; errPassportImage: string;
    errFileSize: string; errAtLeastOne: string; errSummary: (n: number) => string;
    confirmTitle: string; confirmBody: (done: number, total: number) => string;
    confirmYes: (n: number) => string; confirmNo: string;
  };
};

const ja: Dict = {
  site: { name: "一棟貸し宿「日靜」", about: "About Us", terms: "利用規約", privacy: "プライバシーポリシー", faq: "よくある質問" },
  nav: { reserve: "予約", lookup: "予約照会", checkin: "チェックイン", account: "マイページ", login: "ログイン" },
  reserve: {
    location: "所在地", contact: "お問い合わせ",
    noPlans: "現在ご予約いただけるプランがありません。",
    prevYear: "前の年", prevMonth: "前の月", nextMonth: "次の月", nextYear: "次の年",
    monthLabel: (y, m) => `${y}年${m + 1}月`,
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
    tapToSelect: "空いている日をタップして宿泊期間を選択",
    checkingAvailability: "空き状況を確認しています…",
    legendSelected: "選択中", legendAvailable: "空室あり", legendFull: "満室・予約不可",
    in: "IN", out: "OUT", nightCount: (n) => `${n}泊`,
    guestsLabel: "人数", guestOption: (n) => `${n}名`, guestsUpTo: (n) => `${n}名まで`, clear: "クリア",
    roomLabel: "日靜（1日1組限定）",
    guestRangeNote: (min, max) => `${min}名〜${max}名でご利用可`,
    perPersonFrom: (yen) => `¥${yen}/人〜`,
    minGuestsNotice: (n) => `このプランは最低${n}名からです`,
    minGuestsBadge: (n) => `最低${n}名から`,
    nightsTaxIncl: (n) => `${n}泊・税サービス料込`,
    perPersonTotal: (amount) => `お一人様 ¥${amount}`,
    longStayApplied: (pct) => `（長期割${pct}%適用）`,
    oneNightTotal: (guests, yen) => `${guests}名・1泊 合計 ¥${yen}`,
    bookTheseDates: "この日程で予約する", selectDates: "日程を選択",
  },
  plan: {
    backHome: "← ホーム", checkIn: "チェックイン", checkOut: "チェックアウト",
    guestsRange: (min, max) => `人数（${min}〜${max}名）`,
    checkAvailability: "空室・料金を確認", full: "満室", book: "予約する",
    available: "✓ 空室があります",
    aboutPlan: "プラン紹介", aboutRoom: "客室紹介", roomFeatures: "部屋特徴",
    features: ["無料WiFi", "洗浄機付トイレ"],
    amenities: "設備・アメニティ", longStay: "長期割引",
    discountLine: (min, max, pct) => `📅 ${max ? `${min}〜${max}泊` : `${min}泊以上`}　${pct}％割引`,
    contentInJapanese: "",
  },
  common: {
    reservationCode: "予約番号", email: "メールアドレス", guests: "人数", nights: "泊",
    plan: "プラン", dates: "日程", submit: "送信する", back: "戻る", loading: "読み込んでいます…",
    required: "必須", optional: "任意", switchLang: "English",
  },
  status: {
    pending: "決済確認中", confirmed: "予約確定", checked_in: "チェックイン済",
    checked_out: "チェックアウト済", cancelled: "キャンセル済", no_show: "ノーショー",
  },
  form: {
    back: "← 戻る", taxIncl: "税・サービス料込",
    summary: (from, to, nights, guests) => `${from} 〜 ${to}（${nights}泊）/ ${guests}名`,
    name: "氏名", lastName: "姓", firstName: "名",
    nameKana: "氏名（カナ）", lastNameKana: "セイ", firstNameKana: "メイ",
    email: "メールアドレス", emailConfirm: "メールアドレス（確認）",
    phone: "電話番号", phonePlaceholder: "0312345678",
    prefecture: "都道府県（自宅）", city: "市区町村（自宅）",
    address: "番地（自宅）", building: "建物名（自宅）",
    prefecturePlaceholder: "北海道", cityPlaceholder: "広尾郡広尾町",
    addressPlaceholder: "山海谷町1-3-11", buildingPlaceholder: "谷海山ビル3階",
    addressHint: "",
    checkInTime: "チェックイン予定時刻",
    survey: "ご要望・アンケート", surveyPlaceholder: "・宿泊の目的\n・ご要望など",
    contact: "連絡事項", contactPlaceholder: "連絡事項がございましたらご入力ください",
    agreePolicy: { before: "", linkText: "キャンセルポリシー", after: "を含む利用規約に同意する" },
    submit: "お支払いへ進む", submitting: "決済ページへ移動しています…",
    errors: {
      rate_limited: "お申し込みの回数が上限に達しました。しばらくしてからお試しください",
      invalid_plan_dates: "プラン・日程が不正です",
      name_email_required: "氏名・メールは必須です",
      kana_required: "氏名（カナ）は必須です",
      address_required: "住所（都道府県・市区町村・番地）は必須です",
      email_mismatch: "メールアドレスが一致しません",
      email_format: "メールアドレスの形式が正しくありません",
      invalid_dates: "日程が不正です",
      too_long: "入力内容が長すぎます",
      invalid_guests: "人数が不正です",
      plan_not_found: "プランが見つかりません",
      price_not_set: "料金が設定されていません",
      sold_out: "満室のため予約できません",
      customer_save_failed: "顧客情報の保存に失敗しました",
      reservation_failed: "予約の作成に失敗しました",
      agree_required: "キャンセルポリシーを含む利用規約への同意が必要です",
      checkout_failed: "決済セッションの作成に失敗しました",
      generic: "処理できませんでした。お手数ですが最初からお試しください",
    },
    errMinGuests: (n) => `このプランは${n}名以上でご予約ください`,
  },
  complete: {
    title: "ご予約ありがとうございます",
    lead: "確認メールをお送りしました。当日のご来館をお待ちしております。",
    notFound: "予約情報を確認できませんでした。",
    amount: "お支払い金額", statusLabel: "状況", paid: "決済完了・予約確定", pending: "決済確認中…",
    guideTitle: "ご予約後のご案内",
    guideCode: "予約番号は必ず保存してください。予約の確認・変更・キャンセルに必要です。",
    guideAccount: {
      before: "会員登録をされている方は、",
      after: "からいつでもご予約の確認・キャンセルが可能です。",
    },
    guideEmail: "チェックイン番号や当日の詳細は、お送りする確認メールにてご確認ください。",
    guideDoor: {
      before: "玄関のドアコードは",
      after: "ページでもご確認いただけます（予約番号とメールアドレスが必要です）。",
    },
    guidePhone: "ご不明な点は下記までお問い合わせください。",
    home: "ホームへ", viewBooking: "予約を確認", receipt: "領収書",
  },
  lookup: {
    title: "予約照会・キャンセル",
    cancelled: "キャンセルを受け付けました。返金がある場合は数日内に処理されます。",
    codePlaceholder: "R-20260601-XXXX",
    emailLabel: "ご予約時のメールアドレス", search: "照会する",
    notFound: "該当する予約が見つかりませんでした。予約番号とメールをご確認ください。",
    doorCode: "🔑 玄関ドアコード",
    validBetween: (from, to) => `有効期間: ${from} 〜 ${to}`,
    doNotShare: "このコードは第三者に共有しないようお願いします。",
    notIssuedYet: "ドアコードはチェックイン前日のご案内メールでお知らせします。",
    policy: "キャンセルポリシー: 7日前まで無料 / 3日前まで50% / 当日100%",
    requestCancel: "キャンセルを申請する",
  },
  cancel: {
    title: "キャンセル申請",
    notFound: "予約が確認できませんでした。", backToLookup: "予約照会へ戻る",
    alreadyCancelled: "この予約はすでにキャンセル済みです。", home: "ホームへ",
    paidAmount: "お支払い済み金額", refundAmount: "返金予定額",
    dateRange: (from, to, nights) => `${from} 〜 ${to}（${nights}泊）`,
    refundNote: (days, pct, fee) => `チェックインまで ${days} 日 ・ キャンセル料 ${pct}%（¥${fee}）`,
    reason: "キャンセル理由", detail: "詳細（任意）",
    detailPlaceholder: "差し支えなければ詳しい理由をお聞かせください",
    irreversible: "※ キャンセルを確定すると取り消せません。返金は Stripe を通じて数日内に処理されます。",
    back: "戻る", confirm: "キャンセルを確定する", confirming: "手続き中です…",
    doneTitle: "キャンセルを承りました",
    doneLead: "ご予約のキャンセルを受け付けました。確認メールをお送りします。",
    refunded: "返金額",
    errors: {
      category_required: "キャンセル理由を選択してください",
      not_found: "予約が見つかりません",
      already_cancelled: "すでにキャンセル済みです",
      refund_failed: "返金処理に失敗しました。お手数ですがお問い合わせください",
      generic: "処理できませんでした。お手数ですがお問い合わせください",
    },
  },
  email: {
    brand: "一棟貸し宿「日靜」",
    footer: "北海道広尾郡広尾町音調津733番地 日靜 / ☎ 070-1251-6275",
    honorific: (name) => `${name} 様`,
    cancelSubject: (code) => `【日靜】キャンセル受付（${code}）`,
    cancelLead: (code) => `ご予約（予約番号 ${code}）のキャンセルを承りました。`,
    refundLabel: "返金額",
    cancelClosing: "返金は Stripe を通じて数日内に処理されます。またのご利用をお待ちしております。",
  },
  receipt: {
    print: "PDFで保存・印刷", title: "領　収　書",
    issuedOn: (d) => `発行日: ${d}`,
    honorific: (name) => `${name} 様`, amount: "金額",
    forStay: (plan) => `但し　ご宿泊代として（${plan}）`,
    stayDates: "宿泊日", received: "上記正に領収いたしました。",
    cannotShow: "領収書を表示できませんでした。",
    notPaidYet: "お支払い完了後に領収書を発行できます。",
    fallbackName: "ご宿泊者",
  },
  checkin: {
    title: "チェックイン",
    lead: "ご予約時の情報を入力すると、玄関のドアコードをご確認いただけます。",
    showCode: "ドアコードを表示する", verifying: "確認中…",
    doorCode: "玄関のドアコード", validBetween: "の間だけ有効です",
    howToOpen: "玄関ドアに付いているキーパッドに番号を入力してください。",
    doNotShare: "この番号は他の方に共有しないでください。",
    notFound: "予約が見つかりませんでした。予約番号とメールアドレスをご確認ください。",
    cancelled: "この予約はキャンセルされています。",
    checkedOut: "チェックアウト済みの予約です。",
    unpaid: "決済の確認が取れていません。しばらく経ってから再度お試しください。",
    noShow: "この予約はご利用いただけません。宿までお問い合わせください。",
    notIssued: "ドアコードがまだ発行されていません。",
    contactUs: "お手数ですが宿までご連絡ください。",
    doCheckin: "チェックインする", checkedIn: "チェックインを受け付けました。ごゆっくりお過ごしください。",
    arrivalNote: "到着されたらお知らせください。宿側に到着が伝わります。",
    tooMany: "試行回数が多すぎます。しばらく経ってからお試しください。",
  },
  register: {
    title: "宿泊者名簿のご記入",
    lead: "旅館業法により、ご宿泊者全員分の記録が必要です。ご宿泊前にご記入をお願いいたします。",
    status: "ご記入状況", person: "人目の方", representative: "（代表者）",
    fullName: "お名前", furigana: "ふりがな", furiganaHint: "例: やまだ たろう",
    address: "ご住所", addressHint: "都道府県から番地まで",
    contact: "ご連絡先", contactHint: "電話番号またはメールアドレス",
    occupation: "ご職業", birthDate: "生年月日", gender: "性別", noAnswer: "未回答",
    male: "男性", female: "女性", other: "その他",
    foreign: "日本国内に住所をお持ちでない方",
    foreignNote: "該当する場合、法令により国籍と旅券番号の記載が必要です。",
    nationality: "国籍", passportNo: "旅券番号",
    passportImage: "旅券（パスポート）の写し",
    passportImageHint: "顔写真のページを撮影したものをご添付ください（JPEG・PNG・WebP・PDF、10MBまで）。",
    alreadyUploaded: "すでに登録済みです。差し替える場合のみお選びください。",
    addNext: "＋ 次の人を登録する", submitAll: "この内容で登録する",
    editLater: "あとからこのページを開き直せば、内容の修正もできます。",
    invalidUrl: "このURLは無効です。お手数ですが宿までお問い合わせください。",
    done: "名分のご記入を受け付けました。ありがとうございました。",
    errName: "お名前をご記入ください", errAddress: "ご住所をご記入ください",
    errContact: "ご連絡先をご記入ください",
    errContactFormat: "電話番号またはメールアドレスの形式でご記入ください",
    errBirth: "生年月日が未来の日付になっています",
    errNationality: "国籍をご記入ください", errPassportNo: "旅券番号をご記入ください",
    errPassportImage: "旅券（パスポート）の写しをご添付ください",
    errFileSize: "ファイルサイズは10MBまでにしてください",
    errAtLeastOne: "少なくとも1人分のご記入をお願いいたします",
    errSummary: (n) => `ご記入内容に${n}件の不備があります。赤い箇所をご確認ください。`,
    confirmTitle: "全員分の名簿が未登録です",
    confirmBody: (done, total) =>
      `ご予約は${total}名ですが、現在${done}名分のご記入です。このまま登録することもできますが、ご宿泊までに全員分のご記入をお願いいたします。`,
    confirmYes: (n) => `このまま${n}名分を登録する`, confirmNo: "戻って記入する",
  },
};

const en: Dict = {
  site: { name: "Nissei — private house & sauna", about: "About Us", terms: "Terms", privacy: "Privacy", faq: "FAQ" },
  nav: { reserve: "Book", lookup: "Find booking", checkin: "Check-in", account: "My page", login: "Log in" },
  reserve: {
    location: "Address", contact: "Contact",
    noPlans: "There are no plans available for booking at the moment.",
    prevYear: "Previous year", prevMonth: "Previous month", nextMonth: "Next month", nextYear: "Next year",
    monthLabel: (y, m) =>
      `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]} ${y}`,
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    tapToSelect: "Tap an available date to choose your stay",
    checkingAvailability: "Checking availability…",
    legendSelected: "Selected", legendAvailable: "Available", legendFull: "Fully booked",
    in: "IN", out: "OUT", nightCount: (n) => (n === 1 ? "1 night" : `${n} nights`),
    guestsLabel: "Guests", guestOption: (n) => (n === 1 ? "1 guest" : `${n} guests`), guestsUpTo: (n) => `up to ${n}`, clear: "Clear",
    roomLabel: "The whole house, one group per day",
    guestRangeNote: (min, max) => `For ${min}–${max} guests`,
    perPersonFrom: (yen) => `From ¥${yen} per person`,
    minGuestsNotice: (n) => `This plan starts at ${n} guests`,
    minGuestsBadge: (n) => `From ${n} guests`,
    nightsTaxIncl: (n) => `${n === 1 ? "1 night" : `${n} nights`}, tax and service included`,
    perPersonTotal: (amount) => `¥${amount} per person`,
    longStayApplied: (pct) => ` (${pct}% long-stay discount applied)`,
    oneNightTotal: (guests, yen) => `${guests === 1 ? "1 guest" : `${guests} guests`}, 1 night: ¥${yen}`,
    bookTheseDates: "Book these dates", selectDates: "Select your dates",
  },
  plan: {
    backHome: "← Home", checkIn: "Check-in", checkOut: "Check-out",
    guestsRange: (min, max) => `Guests (${min}–${max})`,
    checkAvailability: "Check availability", full: "Fully booked", book: "Book now",
    available: "✓ Available for these dates",
    aboutPlan: "About this plan", aboutRoom: "The house", roomFeatures: "Room features",
    features: ["Free Wi-Fi", "Washlet toilet"],
    amenities: "Amenities", longStay: "Long-stay discounts",
    discountLine: (min, max, pct) =>
      `📅 ${max ? `${min}–${max} nights` : `${min} nights or more`} — ${pct}% off`,
    contentInJapanese:
      "The plan and room descriptions below are written by the owner in Japanese. Please contact us in English if anything is unclear.",
  },
  common: {
    reservationCode: "Booking number", email: "Email address", guests: "Guests", nights: "night(s)",
    plan: "Plan", dates: "Dates", submit: "Submit", back: "Back", loading: "Loading…",
    required: "required", optional: "optional", switchLang: "日本語",
  },
  status: {
    pending: "Awaiting payment", confirmed: "Confirmed", checked_in: "Checked in",
    checked_out: "Checked out", cancelled: "Cancelled", no_show: "No show",
  },
  form: {
    back: "← Back", taxIncl: "Tax and service included",
    summary: (from, to, nights, guests) =>
      `${from} – ${to} (${nights === 1 ? "1 night" : `${nights} nights`}) / ${guests === 1 ? "1 guest" : `${guests} guests`}`,
    name: "Name", lastName: "Family name", firstName: "Given name",
    // 英語フォームではカナを聞かない（海外のお客様は書けないため）
    nameKana: "", lastNameKana: "", firstNameKana: "",
    email: "Email address", emailConfirm: "Email address (confirm)",
    phone: "Phone number", phonePlaceholder: "+81 90 1234 5678",
    prefecture: "State / Province / Region", city: "City",
    address: "Street address", building: "Apartment, suite, etc.",
    prefecturePlaceholder: "California", cityPlaceholder: "San Francisco",
    addressPlaceholder: "1234 Market St, USA", buildingPlaceholder: "Apt 5B",
    addressHint: "Please include your country in the street address.",
    checkInTime: "Estimated arrival time",
    survey: "Requests and comments", surveyPlaceholder: "・Purpose of your stay\n・Any requests",
    contact: "Anything else we should know", contactPlaceholder: "Let us know if there is anything else",
    agreePolicy: { before: "I agree to the terms of use, including the ", linkText: "cancellation policy", after: "." },
    submit: "Continue to payment", submitting: "Taking you to the payment page…",
    errors: {
      rate_limited: "You have reached the limit for booking attempts. Please try again later.",
      invalid_plan_dates: "The plan or dates are not valid.",
      name_email_required: "Name and email address are required.",
      kana_required: "Name in katakana is required.",
      address_required: "Region, city and street address are required.",
      email_mismatch: "The email addresses do not match.",
      email_format: "Please enter a valid email address.",
      invalid_dates: "The dates are not valid.",
      too_long: "One of the fields is too long.",
      invalid_guests: "The number of guests is not valid.",
      plan_not_found: "We could not find that plan.",
      price_not_set: "No rate has been set for this plan.",
      sold_out: "Those dates are no longer available.",
      customer_save_failed: "We could not save your details.",
      reservation_failed: "We could not create the booking.",
      agree_required: "Please agree to the terms of use, including the cancellation policy.",
      checkout_failed: "We could not start the payment session.",
      generic: "We could not complete that. Please start again.",
    },
    errMinGuests: (n) => `This plan requires at least ${n} guests.`,
  },
  complete: {
    title: "Thank you for your booking",
    lead: "We have sent you a confirmation email. We look forward to welcoming you.",
    notFound: "We could not load the booking details.",
    amount: "Amount paid", statusLabel: "Status", paid: "Paid — booking confirmed", pending: "Confirming payment…",
    guideTitle: "What happens next",
    guideCode: "Please keep your booking number. You need it to view, change or cancel your booking.",
    guideAccount: {
      before: "If you have an account, you can view and cancel your booking any time from ",
      after: ".",
    },
    guideEmail: "Your door code and arrival details are in the confirmation email.",
    guideDoor: {
      before: "You can also see the entrance door code on the ",
      after: " page (booking number and email address required).",
    },
    guidePhone: "If anything is unclear, please contact us.",
    home: "Home", viewBooking: "View booking", receipt: "Receipt",
  },
  lookup: {
    title: "Find or cancel your booking",
    cancelled: "Your cancellation has been accepted. Any refund will be processed within a few days.",
    codePlaceholder: "R-20260601-XXXX",
    emailLabel: "Email address used for the booking", search: "Find booking",
    notFound: "We could not find that booking. Please check the booking number and email address.",
    doorCode: "🔑 Entrance door code",
    validBetween: (from, to) => `Valid ${from} – ${to}`,
    doNotShare: "Please do not share this code with anyone else.",
    notIssuedYet: "We will send your door code by email the day before check-in.",
    policy: "Cancellation policy: free until 7 days before, 50% until 3 days before, 100% on the day.",
    requestCancel: "Request cancellation",
  },
  cancel: {
    title: "Cancel your booking",
    notFound: "We could not find that booking.", backToLookup: "Back to booking lookup",
    alreadyCancelled: "This booking has already been cancelled.", home: "Home",
    paidAmount: "Amount paid", refundAmount: "Refund amount",
    dateRange: (from, to, nights) => `${from} – ${to} (${nights === 1 ? "1 night" : `${nights} nights`})`,
    refundNote: (days, pct, fee) =>
      `${days} day(s) until check-in — cancellation fee ${pct}% (¥${fee})`,
    reason: "Reason for cancelling", detail: "Details (optional)",
    detailPlaceholder: "Tell us more if you would like to",
    irreversible:
      "Once confirmed, a cancellation cannot be undone. Refunds are processed through Stripe within a few days.",
    back: "Back", confirm: "Confirm cancellation", confirming: "Processing…",
    doneTitle: "Your booking is cancelled",
    doneLead: "We have cancelled your booking and will send you a confirmation email.",
    refunded: "Refunded",
    errors: {
      category_required: "Please choose a reason.",
      not_found: "We could not find that booking.",
      already_cancelled: "This booking has already been cancelled.",
      refund_failed: "The refund could not be processed. Please contact us.",
      generic: "We could not complete that. Please contact us.",
    },
  },
  email: {
    brand: "Nissei — private house & sauna",
    footer: "733 Otsunai, Hiroo-cho, Hiroo-gun, Hokkaido 089-2661, Japan / ☎ +81 70-1251-6275",
    honorific: (name) => `Dear ${name},`,
    cancelSubject: (code) => `[Nissei] Your booking is cancelled (${code})`,
    cancelLead: (code) => `We have cancelled your booking (booking number ${code}).`,
    refundLabel: "Refund amount",
    cancelClosing:
      "Your refund will be processed through Stripe within a few days. We hope to welcome you another time.",
  },
  receipt: {
    print: "Save as PDF / print", title: "RECEIPT",
    issuedOn: (d) => `Issued: ${d}`,
    honorific: (name) => name, amount: "Amount",
    forStay: (plan) => `For accommodation (${plan})`,
    stayDates: "Stay", received: "Payment received with thanks.",
    cannotShow: "We could not display the receipt.",
    notPaidYet: "The receipt is available once payment is complete.",
    fallbackName: "Guest",
  },
  checkin: {
    title: "Check-in",
    lead: "Enter your booking details to see the door code for the entrance.",
    showCode: "Show door code", verifying: "Checking…",
    doorCode: "Entrance door code", validBetween: "only",
    howToOpen: "Enter the code on the keypad attached to the entrance door.",
    doNotShare: "Please do not share this code with anyone else.",
    notFound: "We could not find that booking. Please check the booking number and email address.",
    cancelled: "This booking has been cancelled.",
    checkedOut: "This booking has already been checked out.",
    unpaid: "We have not been able to confirm your payment yet. Please try again shortly.",
    noShow: "This booking cannot be used. Please contact us.",
    notIssued: "The door code has not been issued yet.",
    contactUs: "Please contact us and we will help.",
    doCheckin: "Check in", checkedIn: "You are checked in. We hope you enjoy your stay.",
    arrivalNote: "Let us know when you arrive and we will be notified.",
    tooMany: "Too many attempts. Please try again later.",
  },
  register: {
    title: "Guest register",
    lead: "Japanese law requires us to record details for every guest staying with us. Please complete this before your stay.",
    status: "Completed", person: "Guest", representative: " (lead guest)",
    fullName: "Full name", furigana: "Name in Kana / Reading (Optional)", furiganaHint: "e.g. Yamada Taro",
    address: "Home address", addressHint: "Include country, city and street",
    contact: "Contact", contactHint: "Phone number or email address",
    occupation: "Occupation", birthDate: "Date of birth", gender: "Gender", noAnswer: "Prefer not to say",
    male: "Male", female: "Female", other: "Other",
    foreign: "I do not have an address in Japan",
    foreignNote: "If this applies to you, Japanese law requires your nationality and passport number.",
    nationality: "Nationality", passportNo: "Passport number",
    passportImage: "Copy of your passport",
    passportImageHint: "Please attach a photo of the page with your picture (JPEG, PNG, WebP or PDF, up to 10MB).",
    alreadyUploaded: "Already uploaded. Choose a file only if you want to replace it.",
    addNext: "+ Add another guest", submitAll: "Submit",
    editLater: "You can reopen this page later to correct your details.",
    invalidUrl: "This link is not valid. Please contact us and we will help.",
    done: "guest(s) recorded. Thank you.",
    errName: "Please enter the full name", errAddress: "Please enter the home address",
    errContact: "Please enter a contact",
    errContactFormat: "Please enter a valid phone number or email address",
    errBirth: "The date of birth is in the future",
    errNationality: "Please enter the nationality", errPassportNo: "Please enter the passport number",
    errPassportImage: "Please attach a copy of the passport",
    errFileSize: "The file must be 10MB or smaller",
    errAtLeastOne: "Please complete at least one guest",
    errSummary: (n) => `${n} field(s) need attention. Please check the items marked in red.`,
    confirmTitle: "Not all guests are recorded",
    confirmBody: (done, total) =>
      `Your booking is for ${total} guest(s) and ${done} have been recorded so far. You can submit now, but please complete the rest before your stay.`,
    confirmYes: (n) => `Submit ${n} guest(s)`, confirmNo: "Go back and complete",
  },
};

export function dict(locale: Locale): Dict {
  return locale === "en" ? en : ja;
}
