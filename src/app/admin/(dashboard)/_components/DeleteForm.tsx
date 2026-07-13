"use client";

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
      <button className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40">
        {label}
      </button>
    </form>
  );
}
