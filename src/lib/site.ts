// 公開サイトの基本情報。検索結果・SNS共有・構造化データで使う。
// 予約システムの説明ではなく「宿の紹介」を書く。検索した人が読むのはこちら。

export const SITE = {
  name: "一棟貸し宿「日靜」",
  shortName: "日靜（NISSEI）",
  tagline: "北海道・広尾町のプライベートサウナ付き一棟貸し宿",
  description:
    "北海道十勝・広尾町音調津の一棟貸し宿「日靜」。1日1組限定で、貸切サウナ「KOBU SAUNA」を独り占め。素泊まり・日帰り利用も承ります。",
  address: {
    postalCode: "089-2661",
    region: "北海道",
    locality: "広尾郡広尾町",
    street: "音調津733番地",
    full: "北海道広尾郡広尾町音調津733番地",
    // 英語ページ用。DB の facility.address は日本語表記のみなので、
    // 海外のお客様が地図アプリに入れられる形をこちらで持つ。
    fullEn: "733 Otsunai, Hiroo-cho, Hiroo-gun, Hokkaido 089-2661, Japan",
  },
  phone: "070-1251-6275",
  email: "info@gh-nissei.jp",
  checkIn: "15:00",
  checkOut: "10:00",
  maxGuests: 8,
} as const;

export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return fromEnv || "https://reserve.gh-nissei.jp";
}

/** 宿泊施設の構造化データ。Google に「宿」として理解させる。 */
export function lodgingJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: SITE.name,
    // 英語で検索されたときに宿名が結び付くようにする
    alternateName: "Nissei — private house with sauna, Hiroo, Hokkaido",
    knowsLanguage: ["ja", "en"],
    description: SITE.description,
    url: siteUrl(),
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      postalCode: SITE.address.postalCode,
      addressRegion: SITE.address.region,
      addressLocality: SITE.address.locality,
      streetAddress: SITE.address.street,
      addressCountry: "JP",
    },
    checkinTime: SITE.checkIn,
    checkoutTime: SITE.checkOut,
    petsAllowed: false,
    smokingAllowed: false,
    numberOfRooms: 1,
    amenityFeature: [
      "貸切サウナ",
      "無料Wi-Fi",
      "駐車場",
      "キッチン",
      "洗濯機",
      "エアコン",
    ].map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
  });
}
