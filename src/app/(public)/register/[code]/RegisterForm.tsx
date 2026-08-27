"use client";

import { useRef, useState } from "react";
import { GENDERS } from "@/lib/guests";
import { dict, type Locale } from "@/lib/i18n";
import { SubmitButton } from "@/components/SubmitButton";
import { submitGuestRegistration } from "./actions";

export type ExistingGuest = {
  guest_order: number;
  full_name: string;
  furigana: string | null;
  address: string | null;
  contact: string | null;
  occupation: string | null;
  gender: string | null;
  birth_date: string | null;
  is_foreign_national: boolean;
  nationality: string | null;
  passport_number: string | null;
  passport_image_url: string | null;
};

const field =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-brand-500";
const ok = "border-gray-300";
const ng = "border-red-400 bg-red-50";

type Errors = Record<string, string>;

export function RegisterForm({
  secretCode,
  numGuests,
  existing,
  locale = "ja",
}: {
  secretCode: string;
  numGuests: number;
  existing: ExistingGuest[];
  locale?: Locale;
}) {
  const t = dict(locale).register;
  const c = dict(locale).common;
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<string | null>(null);
  // 一度に全員分の空欄を並べると圧が強いので、1人ずつ増やしていく
  const [visible, setVisible] = useState(Math.max(1, existing.length));
  const [pending, setPending] = useState<{ done: number } | null>(null);
  const bypassRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const orders = Array.from({ length: visible }, (_, i) => i + 1);
  const find = (i: number) => existing.find((g) => g.guest_order === i);
  const maxGuests = Math.max(numGuests, existing.length) + 4;

  // ブラウザ標準の警告ではなく、どこを直せばよいか分かる日本語を出す
  function validate(form: HTMLFormElement): Errors {
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value.trim() ?? "";
    const checked = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.checked ?? false;

    const next: Errors = {};
    let filled = 0;

    for (const i of orders) {
      const name = get(`full_name_${i}`);
      const address = get(`address_${i}`);
      const contact = get(`contact_${i}`);
      const any = name || address || contact;
      if (!any) continue;
      filled += 1;

      if (!name) next[`full_name_${i}`] = t.errName;
      if (!address) next[`address_${i}`] = t.errAddress;
      if (!contact) {
        next[`contact_${i}`] = t.errContact;
      } else if (!/^[0-9+\-() 　]{8,}$/.test(contact) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
        next[`contact_${i}`] = t.errContactFormat;
      }

      const birth = get(`birth_date_${i}`);
      if (birth && new Date(birth) > new Date()) {
        next[`birth_date_${i}`] = t.errBirth;
      }

      if (checked(`is_foreign_national_${i}`)) {
        if (!get(`nationality_${i}`)) next[`nationality_${i}`] = t.errNationality;
        if (!get(`passport_number_${i}`)) next[`passport_number_${i}`] = t.errPassportNo;
        // 法令上、国内に住所の無い方は旅券の写しの保存が要る
        const file = (form.elements.namedItem(`passport_image_${i}`) as HTMLInputElement | null)
          ?.files?.[0];
        if (!file && !find(i)?.passport_image_url) {
          next[`passport_image_${i}`] = t.errPassportImage;
        } else if (file && file.size > 10 * 1024 * 1024) {
          next[`passport_image_${i}`] = t.errFileSize;
        }
      }
    }

    if (filled === 0) next.__form = t.errAtLeastOne;
    return next;
  }

  function filledCount(form: HTMLFormElement): number {
    let n = 0;
    for (const i of orders) {
      const v = (form.elements.namedItem(`full_name_${i}`) as HTMLInputElement | null)?.value.trim();
      if (v) n += 1;
    }
    return n;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const found = validate(form);

    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setErrors(found);
      setSummary(
        found.__form ?? t.errSummary(Object.keys(found).length),
      );
      form.querySelector<HTMLElement>("[data-invalid='true']")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    // 全員分揃っていなくても登録はできる。ただし気づかず送ってしまわないよう一度確認する。
    const done = filledCount(form);
    if (!bypassRef.current && done < numGuests) {
      e.preventDefault();
      setPending({ done });
      return;
    }
    setErrors({});
    setSummary(null);
  }

  const Err = ({ name }: { name: string }) =>
    errors[name] ? <p className="text-xs text-red-600">{errors[name]}</p> : null;

  const cls = (name: string) => `${field} ${errors[name] ? ng : ok}`;

  return (
    <form ref={formRef} action={submitGuestRegistration} onSubmit={onSubmit} noValidate className="space-y-6">
      <input type="hidden" name="secret_code" value={secretCode} />
      <input type="hidden" name="guest_count" value={visible} />
      <input type="hidden" name="locale" value={locale} />

      {summary && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{summary}</p>
      )}

      {orders.map((i) => {
        const g = find(i);
        return (
          <fieldset
            key={i}
            data-invalid={Object.keys(errors).some((k) => k.endsWith(`_${i}`))}
            className="space-y-4 rounded-2xl border border-gray-200 p-6"
          >
            <legend className="px-2 text-sm font-medium text-gray-900">
              {t.person} {i}{i === 1 ? t.representative : ""}
            </legend>

            <label className="block space-y-1">
              <span className="text-sm text-gray-700">{t.fullName} <span className="text-red-500">*</span></span>
              <input name={`full_name_${i}`} defaultValue={g?.full_name ?? ""} className={cls(`full_name_${i}`)} />
              <Err name={`full_name_${i}`} />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-gray-700">{t.furigana}</span>
              <input
                name={`furigana_${i}`}
                defaultValue={g?.furigana ?? ""}
                placeholder={t.furiganaHint}
                className={cls(`furigana_${i}`)}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-gray-700">{t.address} <span className="text-red-500">*</span></span>
              <input
                name={`address_${i}`}
                defaultValue={g?.address ?? ""}
                placeholder={t.addressHint}
                className={cls(`address_${i}`)}
              />
              <Err name={`address_${i}`} />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-gray-700">{t.contact} <span className="text-red-500">*</span></span>
              <input
                name={`contact_${i}`}
                defaultValue={g?.contact ?? ""}
                placeholder={t.contactHint}
                className={cls(`contact_${i}`)}
              />
              <Err name={`contact_${i}`} />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-gray-700">{t.occupation}</span>
              <input name={`occupation_${i}`} defaultValue={g?.occupation ?? ""} className={cls(`occupation_${i}`)} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">{t.birthDate}</span>
                <input
                  type="date"
                  name={`birth_date_${i}`}
                  defaultValue={g?.birth_date ?? ""}
                  className={cls(`birth_date_${i}`)}
                />
                <Err name={`birth_date_${i}`} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">{t.gender}</span>
                <select name={`gender_${i}`} defaultValue={g?.gender ?? ""} className={cls(`gender_${i}`)}>
                  <option value="">{t.noAnswer}</option>
                  {GENDERS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3 rounded-lg bg-gray-50 p-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name={`is_foreign_national_${i}`}
                  defaultChecked={g?.is_foreign_national ?? false}
                  className="h-4 w-4"
                />
                {t.foreign}
              </label>
              <p className="text-xs text-gray-500">
                {t.foreignNote}
              </p>
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">{t.nationality}</span>
                <input name={`nationality_${i}`} defaultValue={g?.nationality ?? ""} className={cls(`nationality_${i}`)} />
                <Err name={`nationality_${i}`} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">{t.passportNo}</span>
                <input
                  name={`passport_number_${i}`}
                  defaultValue={g?.passport_number ?? ""}
                  className={cls(`passport_number_${i}`)}
                />
                <Err name={`passport_number_${i}`} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">{t.passportImage}</span>
                <input
                  type="file"
                  name={`passport_image_${i}`}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className={`${cls(`passport_image_${i}`)} file:mr-3 file:rounded file:border-0 file:bg-gray-200 file:px-3 file:py-1 file:text-sm`}
                />
                <span className="block text-xs text-gray-500">
                  {t.passportImageHint}
                  {g?.passport_image_url ? ` ${t.alreadyUploaded}` : ""}
                </span>
                <Err name={`passport_image_${i}`} />
              </label>
            </div>
          </fieldset>
        );
      })}

      {visible < maxGuests && (
        <button
          type="button"
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (!form) return;
            // 途中を空のまま増やされると、誰の記録か分からない行が残る
            const found = validate(form);
            if (Object.keys(found).length > 0) {
              setErrors(found);
              setSummary(found.__form ?? t.errSummary(Object.keys(found).length));
              return;
            }
            setErrors({});
            setSummary(null);
            setVisible((v) => v + 1);
          }}
          className="w-full rounded-full border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t.addNext}（{visible} / {numGuests}）
        </button>
      )}

      <SubmitButton
        pendingLabel={c.loading}
        className="w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700"
      >
        {t.submitAll}
      </SubmitButton>
      <p className="text-center text-xs text-gray-500">
        {t.editLater}
      </p>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">{t.confirmTitle}</h2>
            <p className="text-sm text-gray-600">
              {t.confirmBody(pending.done, numGuests)}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  bypassRef.current = true;
                  setPending(null);
                  formRef.current?.requestSubmit();
                }}
                className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                {t.confirmYes(pending.done)}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="w-full rounded-full border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t.confirmNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
