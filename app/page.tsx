import { ClipboardList, MessageCircle, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IBA Connect",
  description: "A verified, IBA-only network for finding the right people on campus.",
};

const FEATURES = [
  { icon: Search, title: "Find the right person", text: "Search students and alumni by course, skill and who can advise." },
  { icon: MessageCircle, title: "Connect and chat", text: "Send a short request; chat once they accept. Emails stay private until then." },
  { icon: ClipboardList, title: "Post a need", text: "Looking for a study partner or a teammate? Post it on the Need Board." },
  { icon: ShieldCheck, title: "IBA only", text: "Every member is a verified IBA student or alumnus." },
];

/** Landing page. Signed-in members are sent to their dashboard by the proxy. */
export default function Home() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-cover bg-center" style={{ backgroundImage: "url('/bg.png')" }}>
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold text-white">
          <Image src="/logo.png" alt="" width={36} height={36} priority />
          <span>IBA Connect</span>
        </div>
        <Link href="/sign-in" className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-white">
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-16">
        <div className="max-w-2xl space-y-5 text-white">
          <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">Find the right people at IBA.</h1>
          <p className="text-lg text-white/85">
            A study partner, a senior who took the course, a project teammate, or an alumnus in your field: search the
            verified IBA network and reach out.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-[#8b0000] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6b0000]">
              Create account
            </Link>
            <Link href="/sign-in" className="rounded-xl bg-white/95 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-white">
              Sign in
            </Link>
            <Link href="/verify-alumni" className="rounded-xl border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              I am an alumnus
            </Link>
          </div>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl bg-white/95 p-5 text-gray-900 shadow-lg">
              <Icon aria-hidden className="mb-3 size-6 text-[#8b0000]" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-gray-600">{text}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-white/70">
        Team NameNotFound · Software Engineering, IBA Karachi · Profile details are self-declared.
      </footer>
    </div>
  );
}
