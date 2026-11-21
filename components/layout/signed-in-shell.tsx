import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { getCurrentMember, getIdentity } from "@/lib/auth/session";
import { inboxCounts } from "@/lib/services/connections";
import { unreadTotal } from "@/lib/services/messages";
import { avatarUrl } from "@/lib/storage/avatars";
import { AppShell } from "./app-shell";

/**
 * Loads the signed-in member and renders the app shell around the page.
 * Pages are also protected by the proxy; this is the authoritative server check.
 */
export async function SignedInShell({ children }: { children: ReactNode }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");
  if (!identity.emailVerified) redirect("/verify?error=unverified");

  const member = await getCurrentMember();
  if (!member || member.deletedAt) redirect("/sign-in");
  // Suspended members are signed out on their next request (FR1.6, FR8.3)
  if (member.status === UserStatus.SUSPENDED) redirect("/sign-out?reason=suspended");

  return (
    <AppShell
      user={{ name: member.name, avatarUrl: await avatarUrl(member.avatarPath), isAdmin: member.role === Role.ADMIN }}
      counts={{ requests: (await inboxCounts(member.id)).incoming, messages: await unreadTotal(member.id) }}
    >
      {children}
    </AppShell>
  );
}

export function SignedInShellFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30" aria-busy="true">
      <div className="h-14 border-b bg-background" />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
