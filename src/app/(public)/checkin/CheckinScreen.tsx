import { CheckinForm } from "./CheckinForm";
import { dict, type Locale } from "@/lib/i18n";

// 日英で同じ中身を出すための画面本体。
// page.tsx は任意のプロパティを受け取れないので、部品側に切り出している。
export function CheckinScreen({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{dict(locale).checkin.title}</h1>
      <CheckinForm locale={locale} />
    </div>
  );
}
