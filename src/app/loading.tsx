import { Spinner } from "@/components/SubmitButton";

// (public) と admin/(dashboard) の外側（ログイン画面など）の受け皿。
// どの画面でも「読み込み中」が出るようにしておく。
export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">読み込んでいます…</p>
    </div>
  );
}
