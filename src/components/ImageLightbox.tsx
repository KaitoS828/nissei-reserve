"use client";

import { useEffect, useState } from "react";

// サムネイルをクリックすると拡大表示（前後の写真・サムネイル帯付き）
export function ImageLightbox({
  images,
  altPrefix,
  visibleCount,
  thumbClassName = "h-24 sm:h-28",
}: {
  images: string[];
  /** alt文言の接頭辞（例:「一棟貸し宿「日靜」」「素泊まりプラン」）。何の写真かを画像検索・AIに伝える。 */
  altPrefix: string;
  /** グリッドに並べるサムネイル数の上限（省略時は全件）。拡大表示は常に全件を巡回する。 */
  visibleCount?: number;
  thumbClassName?: string;
}) {
  const altOf = (i: number) => `${altPrefix}の写真 ${i + 1}枚目`;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, images.length]);

  if (images.length === 0) return null;
  const visible = visibleCount ? images.slice(0, visibleCount) : images;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visible.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`${thumbClassName} overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition hover:opacity-90`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={altOf(i)} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute right-4 top-4 text-3xl leading-none text-white/80 hover:text-white"
            aria-label="閉じる"
          >
            ×
          </button>

          <div
            className="relative flex w-full max-w-4xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[openIndex]}
              alt={altOf(openIndex)}
              className="max-h-[70vh] max-w-full rounded-lg object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length))}
                  className="absolute left-2 rounded-full bg-black/40 px-3 py-2 text-2xl leading-none text-white hover:bg-black/60"
                  aria-label="前の写真"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setOpenIndex((i) => (i === null ? i : (i + 1) % images.length))}
                  className="absolute right-2 rounded-full bg-black/40 px-3 py-2 text-2xl leading-none text-white hover:bg-black/60"
                  aria-label="次の写真"
                >
                  ›
                </button>
              </>
            )}
          </div>

          <p className="mt-3 text-xs text-white/70">
            {openIndex + 1} / {images.length}
          </p>

          {images.length > 1 && (
            <div
              className="mt-3 flex max-w-full gap-2 overflow-x-auto px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded border-2 transition ${
                    i === openIndex ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={altOf(i)} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
