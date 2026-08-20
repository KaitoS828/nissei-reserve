"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveGalleryImages } from "@/lib/plan-gallery-actions";

// プラン詳細ページに載せるギャラリー写真の編集UI。
// /admin/masters/plans と /admin/site-settings の両方から使う。
export function PlanGalleryEditor({ planId, initialImages }: { planId: string; initialImages: string[] }) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.url) setImages((prev) => [...prev, data.url]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await saveGalleryImages(planId, images);
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded border-2 border-dashed border-gray-300 p-3 text-center">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          id={`plan-gallery-upload-${planId}`}
          className="hidden"
        />
        <label
          htmlFor={`plan-gallery-upload-${planId}`}
          className="cursor-pointer font-semibold text-gray-900 hover:underline"
        >
          {isUploading ? "アップロード中..." : "📸 写真を選択 / 追加"}
        </label>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, idx) => (
            <div key={idx} className="group relative h-20 overflow-hidden rounded border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white opacity-90 hover:bg-red-600"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded bg-cyan-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-50"
        >
          {isSaving ? "保存中..." : "この写真を保存"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ 保存しました</span>}
      </div>
    </div>
  );
}
