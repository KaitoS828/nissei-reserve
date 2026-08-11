"use client";

import { SubmitButton } from "@/components/SubmitButton";

export function DeleteForm({
  action,
  id,
  confirmMessage,
  label = "削除",
}: {
  action: (formData: FormData) => void;
  id: string;
  confirmMessage: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-100">
        {label}
      </SubmitButton>
    </form>
  );
}
