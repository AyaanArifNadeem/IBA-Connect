import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlumniForm } from "./alumni-form";

export const metadata: Metadata = { title: "Alumni verification · IBA Connect" };

/** Alumni sign-up with a personal email and a code or the alumni list (FR1.3, US1.4, wireframe P02-B). */
export default function VerifyAlumniPage() {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-center px-4 py-16"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute top-6 left-6">
        <Link href="/sign-in">
          <Image src="/logo.png" alt="IBA Connect" width={40} height={40} priority />
        </Link>
      </div>
      <main className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Alumni verification</h1>
        <p className="mt-1 text-xs text-gray-500">
          Graduated from IBA? Join with your personal email and a code from the administration, or the email the
          university has on its alumni list.
        </p>
        <AlumniForm />
        <p className="mt-5 text-center text-xs text-gray-600">
          Already verified?{" "}
          <Link href="/sign-in" className="font-semibold text-[#8b0000] hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
