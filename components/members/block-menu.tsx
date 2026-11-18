"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { postJson, requestJson } from "@/lib/client/api";

/** "⋯" menu on a profile with Block / Unblock (FR3.7, wireframe P07). Report arrives with F8. */
export function BlockMenu({ memberId, memberName, blockedByMe }: { memberId: string; memberName: string; blockedByMe: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function block() {
    setBusy(true);
    const result = await postJson("/api/v1/blocks", { memberId });
    setBusy(false);
    setConfirming(false);
    if (!result.ok) return toast.error(result.error.message);
    toast.success(`${memberName} is blocked`);
    router.refresh();
  }

  async function unblock() {
    const result = await requestJson("DELETE", `/api/v1/blocks/${memberId}`);
    if (!result.ok) return toast.error(result.error.message);
    toast.success(`${memberName} is unblocked`);
    router.refresh();
  }

  if (blockedByMe) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">You blocked this member.</p>
        <Button size="sm" variant="outline" onClick={unblock}>
          Unblock
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More actions for ${memberName}`}
          className="inline-flex h-8 items-center justify-center rounded-lg border px-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setConfirming(true)} className="text-destructive">
            Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {memberName}?</DialogTitle>
            <DialogDescription>
              They will not be able to send you requests or messages, and you will not be able to contact them. Pending
              requests between you are closed. You can unblock them later in Settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={block} disabled={busy}>
              {busy ? "Blocking…" : "Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
