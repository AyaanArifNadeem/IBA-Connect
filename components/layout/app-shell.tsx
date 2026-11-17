import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "./account-menu";
import { BottomNav } from "./bottom-nav";
import { TopNav } from "./top-nav";
import type { ShellCounts, ShellUser } from "./types";

/**
 * Frame for every signed-in page: top menu on desktop, bottom bar on phones
 * (wireframes P04 and P21). Every main screen is one click away (NFR14).
 */
export function AppShell({
  user,
  counts,
  children,
}: {
  user: ShellUser;
  counts: ShellCounts;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
            <span>IBA Connect</span>
          </Link>
          <TopNav counts={counts} />
          <AccountMenu user={user} />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <BottomNav counts={counts} />
    </div>
  );
}
