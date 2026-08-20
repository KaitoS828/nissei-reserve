"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTopPageSettings } from "./actions";
import { PlanGalleryEditor } from "@/components/PlanGalleryEditor";

type Props = {
  initialData: {
    name: string;
    phone: string;
    address: string;
    heroTitle: string;
    heroSub: string;
    heroDescription: string;
    heroImages: string[];
    features: string[];
    plans: {
      id: string;
      name: string;
      price: number;
      tags: string[];
      description: string;
      galleryImages: string[];
    }[];
  };
};

export function VisualSiteBuilder({ initialData }: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"text" | "images" | "features" | "planPhotos">("text");

  // ライブステート
  const [name, setName] = useState(initialData.name);
  const [phone, setPhone] = useState(initialData.phone);
  const [address, setAddress] = useState(initialData.address);
  const [heroTitle, setHeroTitle] = useState(initialData.heroTitle);
  const [heroSub, setHeroSub] = useState(initialData.heroSub);
  const [heroDescription, setHeroDescription] = useState(initialData.heroDescription);
  const [heroImages, setHeroImages] = useState<string[]>(initialData.heroImages);
  const [features, setFeatures] = useState<string[]>(initialData.features);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 画像アップロード処理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setHeroImages((prev) => [...prev, data.url]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setHeroImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    setFeatures((prev) => [...prev, "新しいアピール項目"]);
  };

  const updateFeature = (index: number, val: string) => {
    setFeatures((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  // 保存処理
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("address", address);
      formData.append("hero_title", heroTitle);
      formData.append("hero_sub", heroSub);
      formData.append("hero_description", heroDescription);
      formData.append("hero_images", heroImages.join("\n"));
      formData.append("features", features.join("\n"));

      await updateTopPageSettings(formData);
      router.refresh();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-4 rounded border border-gray-300 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border border-gray-300 bg-gray-100 p-0.5 text-xs">
            <button
              onClick={() => setDevice("desktop")}
              className={`rounded px-3 py-1 font-medium transition ${
                device === "desktop" ? "bg-cyan-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              💻 PC表示
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`rounded px-3 py-1 font-medium transition ${
                device === "mobile" ? "bg-cyan-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📱 スマホ表示
            </button>
          </div>
          <span className="text-xs text-gray-400">| ライブ編集モード</span>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700 animate-pulse">
              ✓ 保存され、本番TOPページに即時反映されました！
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-cyan-700 px-6 py-2 text-xs font-semibold tracking-widest text-white transition hover:bg-cyan-800 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存して本番に反映"}
          </button>
        </div>
      </div>

      {/* メインビルダーエリア（2カラムスプリットビュー） */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        {/* 左側: 編集コントロールパネル */}
        <div className="space-y-4 rounded border border-gray-300 bg-white p-5">
          <div className="flex border-b border-gray-200 text-xs">
            <button
              onClick={() => setActiveTab("text")}
              className={`pb-2 px-3 font-semibold transition ${
                activeTab === "text"
                  ? "border-b-2 border-cyan-700 text-cyan-800"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              テキスト・情報
            </button>
            <button
              onClick={() => setActiveTab("images")}
              className={`pb-2 px-3 font-semibold transition ${
                activeTab === "images"
                  ? "border-b-2 border-cyan-700 text-cyan-800"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              写真アップロード ({heroImages.length})
            </button>
            <button
              onClick={() => setActiveTab("features")}
              className={`pb-2 px-3 font-semibold transition ${
                activeTab === "features"
                  ? "border-b-2 border-cyan-700 text-cyan-800"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              特徴タグ
            </button>
            <button
              onClick={() => setActiveTab("planPhotos")}
              className={`pb-2 px-3 font-semibold transition ${
                activeTab === "planPhotos"
                  ? "border-b-2 border-cyan-700 text-cyan-800"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              プラン別写真
            </button>
          </div>

          {/* TAB 1: テキスト */}
          {activeTab === "text" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700">サブタイトル（英語）</label>
                <input
                  type="text"
                  value={heroSub}
                  onChange={(e) => setHeroSub(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">メイン見出し</label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">紹介文章</label>
                <textarea
                  rows={5}
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs leading-relaxed text-gray-900"
                />
              </div>

              <hr className="border-gray-200" />

              <div>
                <label className="block font-medium text-gray-700">施設名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">所在地</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">電話番号</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs font-mono text-gray-900"
                />
              </div>
            </div>
          )}

          {/* TAB 2: 画像アップロード */}
          {activeTab === "images" && (
            <div className="space-y-4 text-xs">
              <div className="rounded border-2 border-dashed border-gray-300 p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  id="file-upload"
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer font-semibold text-gray-900 hover:underline">
                  {isUploading ? "アップロード中..." : "📸 パソコンから写真を選択 / 追加"}
                </label>
                <p className="mt-1 text-[11px] text-gray-400">JPEG, PNG, WebP に対応</p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-gray-800">掲載中の写真リスト ({heroImages.length})</p>
                {heroImages.length === 0 ? (
                  <p className="text-gray-400">現在カスタム写真はありません（客室マスタ写真が表示されます）。</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                    {heroImages.map((url, idx) => (
                      <div key={idx} className="relative group rounded overflow-hidden border border-gray-200 h-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white opacity-90 hover:bg-red-600"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 特徴タグ */}
          {activeTab === "features" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800">特徴タグ</p>
                <button
                  onClick={addFeature}
                  className="rounded border border-cyan-700 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-700 hover:text-white"
                >
                  + タグ追加
                </button>
              </div>
              <div className="space-y-2">
                {features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={feat}
                      onChange={(e) => updateFeature(idx, e.target.value)}
                      className="w-full rounded border border-gray-300 p-1.5 text-xs text-gray-900"
                    />
                    <button
                      onClick={() => removeFeature(idx)}
                      className="px-1 font-bold text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: プラン別写真 */}
          {activeTab === "planPhotos" && (
            <div className="space-y-4 text-xs">
              <p className="text-gray-500">
                各プランの詳細ページ（見出しの下）に載る写真です。プランごとに個別に保存します。
              </p>
              {initialData.plans.length === 0 && (
                <p className="text-gray-400">有効なプランがありません。</p>
              )}
              <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                {initialData.plans.map((p) => (
                  <div key={p.id} className="space-y-2 rounded border border-gray-200 p-3">
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <PlanGalleryEditor planId={p.id} initialImages={p.galleryImages} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側: リアルタイム ライブプレビュー */}
        <div className={`mx-auto w-full transition-all duration-300 ${device === "mobile" ? "max-w-md" : "max-w-none"}`}>
          <div className="rounded border-2 border-gray-900 bg-gray-100 p-2 shadow-2xl">
            <div className="mb-2 flex items-center justify-between rounded border border-gray-200 bg-white p-4 font-mono text-xs text-gray-400">
              <span>LIVE PREVIEW — /reserve</span>
              <span>{device === "mobile" ? "375px (Mobile)" : "Responsive (PC)"}</span>
            </div>

            {/* リアルタイムに更新される予約TOPページ画面（実際の /reserve と同じ構造） */}
            <div className="space-y-6 rounded border border-gray-200 bg-gray-50/50 p-4 text-gray-800 sm:p-6">
              {/* ヒーロー（フル幅） */}
              <section className="space-y-4 rounded border border-gray-200 bg-white p-6">
                <div className="space-y-2 border-b border-gray-100 pb-4">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {heroSub}
                  </span>
                  <h1 className="font-serif text-xl font-bold tracking-widest text-gray-900">{heroTitle}</h1>
                  <p className="whitespace-pre-wrap text-xs font-light leading-relaxed text-gray-600">
                    {heroDescription}
                  </p>
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {features.map((f, i) => (
                        <span
                          key={i}
                          className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-700"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {heroImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {heroImages.slice(0, 4).map((img, i) => (
                      <div key={i} className="h-16 overflow-hidden rounded border border-gray-200 bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 下段: 左に住所/連絡先、右にプラン一覧（実ページのカレンダー相当） */}
              <div className={`grid gap-6 ${device === "mobile" ? "grid-cols-1" : "md:grid-cols-[220px_1fr]"} items-start`}>
                <aside className="space-y-3 text-xs text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-900">所在地</p>
                    <p className="text-gray-600">{address}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">お問い合わせ</p>
                    <p className="text-gray-600">{phone}</p>
                  </div>
                </aside>

                <section className="space-y-4">
                  <div className="border-b border-gray-900 pb-2">
                    <h2 className="font-serif text-base font-bold tracking-widest text-gray-900">ご宿泊プラン</h2>
                  </div>
                  {initialData.plans.slice(0, 3).map((p) => (
                    <div key={p.id} className="space-y-2 rounded border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-serif text-sm font-bold text-gray-900">{p.name}</h3>
                        <span className="font-serif text-sm font-bold text-gray-900">¥{p.price.toLocaleString()}〜</span>
                      </div>
                      <p className="text-[11px] text-gray-500">{p.description}</p>
                      <div className="pt-2 text-right">
                        <span className="rounded bg-gray-900 px-4 py-1.5 text-[10px] font-semibold text-white">
                          空室状況・日程を選択 →
                        </span>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
