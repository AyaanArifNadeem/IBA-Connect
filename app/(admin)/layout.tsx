import { Suspense } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { SignedInShell, SignedInShellFallback } from "@/components/layout/signed-in-shell";

/** Admin pages (wireframe P20): signed-in shell plus an admin-only check on the server (FR8.5). */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<SignedInShellFallback />}>
      <SignedInShell>
        <AdminGate>{children}</AdminGate>
      </SignedInShell>
    </Suspense>
  );
}
