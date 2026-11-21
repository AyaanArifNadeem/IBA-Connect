import { Suspense } from "react";
import { SignedInShell, SignedInShellFallback } from "@/components/layout/signed-in-shell";

export default function SignedInLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<SignedInShellFallback />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
