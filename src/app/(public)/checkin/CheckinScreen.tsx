import { CheckinForm } from "./CheckinForm";
import { dict, type Locale } from "@/lib/i18n";
import { LangSwitch } from "@/app/(public)/_components/LangSwitch";

// 日英で同じ中身を出すための画面本体。
// page.tsx は任意のプロパティを受け取れないので、部品側に切り出している。
export function CheckinScreen({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{dict(locale).checkin.title}</h1>
        <LangSwitch locale={locale} />
      </div>
      <CheckinForm locale={locale} />
    </div>
  );
}
