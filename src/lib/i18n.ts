// 日英の文言。日本語を既定とし、英語は /en 配下の別URLで出す。
// 同じURLで切り替えるだけだと Google が英語版を別ページとして扱わず、
// 英語圏からの検索流入が取れないため、URLを分ける。

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

type Dict = {
  nav: { reserve: string; lookup: string; checkin: string; account: string; login: string };
  common: {
    reservationCode: string; email: string; guests: string; nights: string;
    plan: string; dates: string; submit: string; back: string; loading: string;
    required: string; optional: string; switchLang: string;
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
    fullName: string; address: string; addressHint: string; contact: string; contactHint: string;
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
  nav: { reserve: "予約", lookup: "予約照会", checkin: "チェックイン", account: "マイページ", login: "ログイン" },
  common: {
    reservationCode: "予約番号", email: "メールアドレス", guests: "人数", nights: "泊",
    plan: "プラン", dates: "日程", submit: "送信する", back: "戻る", loading: "読み込んでいます…",
    required: "必須", optional: "任意", switchLang: "English",
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
    fullName: "お名前", address: "ご住所", addressHint: "都道府県から番地まで",
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
  nav: { reserve: "Book", lookup: "Find booking", checkin: "Check-in", account: "My page", login: "Log in" },
  common: {
    reservationCode: "Booking number", email: "Email address", guests: "Guests", nights: "night(s)",
    plan: "Plan", dates: "Dates", submit: "Submit", back: "Back", loading: "Loading…",
    required: "required", optional: "optional", switchLang: "日本語",
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
    fullName: "Full name", address: "Home address", addressHint: "Include country, city and street",
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
