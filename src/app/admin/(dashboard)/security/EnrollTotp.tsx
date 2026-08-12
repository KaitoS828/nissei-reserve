"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

// enroll のレスポンス（QRコード・シークレット）はその場でしか受け取れないため、
// サーバーに往復させず、ブラウザ側で登録から確認まで完結させる。
export function EnrollTotp() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20";

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // 前回の中断で未確認の factor が残っていると "already exists" で失敗するため掃除する
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) {
      if (factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `authenticator-${Date.now()}`,
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "登録を開始できませんでした");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify() {
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.replace(/\s/g, ""),
    });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setEnrollment(null);
    setCode("");
    router.refresh();
  }

  async function cancel() {
    if (!enrollment) return;
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {busy ? "準備中…" : "認証アプリを登録する"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-600">
        <li>認証アプリ（Google Authenticator、1Password など）でQRコードを読み取ります</li>
        <li>アプリに表示された6桁の数字を入力して「確認する」を押します</li>
      </ol>

      {/* Supabase が返す QR は SVG の data URI。next/image は使わずそのまま表示する */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrCode}
        alt="2段階認証のQRコード"
        className="h-48 w-48 rounded-xl border border-gray-200 bg-white p-2"
      />

      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer">QRコードを読み取れない場合</summary>
        <p className="mt-2">アプリに次のキーを手入力してください。</p>
        <code className="mt-1 block break-all rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
          {enrollment.secret}
        </code>
      </details>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="6桁のコード"
          className={`${field} w-40 text-center font-mono tracking-widest`}
        />
        <button
          onClick={verify}
          disabled={busy || code.replace(/\s/g, "").length !== 6}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {busy ? "確認中…" : "確認する"}
        </button>
        <button
          onClick={cancel}
          disabled={busy}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
