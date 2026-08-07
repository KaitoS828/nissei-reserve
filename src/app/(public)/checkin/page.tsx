import type { Metadata } from "next";
import { CheckinForm } from "./CheckinForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "チェックイン",
  description: "ご予約番号とメールアドレスで、玄関のドアコードをご確認いただけます。",
  robots: { index: false, follow: false },
};

export default function CheckinPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">チェックイン</h1>
      <CheckinForm />
    </div>
  );
}
