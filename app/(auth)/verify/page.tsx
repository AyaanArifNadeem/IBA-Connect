import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ResendVerificationForm } from "./resend-form";

export const metadata: Metadata = { title: "Verify your email · IBA Connect" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  expired: { title: "This link has expired", body: "Verification links work for a limited time. Enter your email to get a new one." },
  invalid: { title: "This link is not valid", body: "The link may have been used already or copied incompletely. Request a new one below." },
  unverified: { title: "Verify your email first", body: "Open the link we emailed you to finish creating your account." },
};
const DEFAULT = { title: "Check your email", body: "We sent you a verification link. Open it to finish creating your account." };

async function VerifyMessage({ searchParams }: { searchParams: PageProps<"/verify">["searchParams"] }) {
  const { error } = await searchParams;
  const message = (typeof error === "string" && MESSAGES[error]) || DEFAULT;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{message.title}</h1>
      <p className="mt-2 text-sm text-gray-600">{message.body}</p>
    </>
  );
}

export default function VerifyPage({ searchParams }: PageProps<"/verify">) {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute top-6 left-6">
        <Link href="/sign-in">
          <Image src="/logo.png" alt="IBA Connect" width={40} height={40} priority />
        </Link>
      </div>
      <main className="w-full max-w-sm rounded-3xl bg-white/95 p-7 text-center shadow-xl">
        <Suspense fallback={<h1 className="text-2xl font-extrabold text-gray-900">Check your email</h1>}>
          <VerifyMessage searchParams={searchParams} />
        </Suspense>
        <ResendVerificationForm />
        <Link href="/sign-in" className="mt-5 inline-block text-xs font-semibold text-gray-500 hover:text-[#8b0000]">
          Back to sign in
        </Link>
      </main>
    </div>
  );
}
