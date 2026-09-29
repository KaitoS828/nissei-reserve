import { ConfirmButton } from "@/components/ConfirmButton";

export function CustomEmailForm({
  email,
  sendAction,
  reservationId,
}: {
  email: string | null;
  sendAction: (formData: FormData) => void;
  reservationId: string;
}) {
  return (
    <details className="rounded-lg border border-cyan-200 bg-cyan-50/40">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-cyan-900">
        ✉️ お客様にメールを送る（自由入力）
      </summary>

      <div className="space-y-3 border-t border-cyan-200 bg-white p-4">
        {email ? (
          <form action={sendAction} className="space-y-3">
            <p className="text-xs text-gray-600">宛先: {email}</p>
            <input
              type="text"
              name="subject"
              placeholder="件名"
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <textarea
              name="body"
              rows={8}
              placeholder="本文（URLは自動的にリンクになります）"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <ConfirmButton
              hidden={{ id: reservationId }}
              title="メールを送信します"
              message={<p>{email} 宛に、入力した件名・本文のメールを送信します。よろしいですか？</p>}
              confirmLabel="はい、送信する"
              className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
            >
              この内容で送信する
            </ConfirmButton>
          </form>
        ) : (
          <p className="text-xs text-gray-500">メールアドレスが未登録のため送信できません。</p>
        )}
      </div>
    </details>
  );
}
