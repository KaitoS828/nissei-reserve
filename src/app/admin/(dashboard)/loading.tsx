export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-cyan-600"
      />
      <p className="text-sm">読み込み中…</p>
    </div>
  );
}
