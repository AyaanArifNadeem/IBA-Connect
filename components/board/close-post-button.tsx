"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/api";

/** Close post early, with the confirm step from wireframe P12 (FR4.4, US4.4). */
export function ClosePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    const result = await postJson(`/api/v1/posts/${postId}/close`, {});
    setBusy(false);
    if (!result.ok) return toast.error(result.error.message);
    setConfirming(false);
    toast.success("Post closed");
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button size="sm" onClick={() => setConfirming(true)}>
        Close post
      </Button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Close this post?" className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 text-sm">
      <span>It leaves the board; you will still see the responses.</span>
      <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <Button size="sm" onClick={close} disabled={busy}>
        {busy ? "Closing…" : "Close"}
      </Button>
    </div>
  );
}
