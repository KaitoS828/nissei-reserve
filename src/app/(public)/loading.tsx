import { Spinner } from "@/components/SubmitButton";

// 画面遷移中に何も変わらないと、押せたのか分からない。
export default function PublicLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">読み込んでいます…</p>
    </div>
  );
}
