import type { Metadata } from "next";
import { RegisterScreen } from "@/app/(public)/register/[code]/RegisterScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest register",
  robots: { index: false, follow: false },
};

export default async function EnRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { code } = await params;
  const { error, done } = await searchParams;
  return <RegisterScreen code={code} error={error} done={done} locale="en" />;
}
