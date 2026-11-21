"use client";

import { Check, Clock, MessageCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getJson, postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export type RelationshipView =
  | { state: "none" | "self" | "blocked" }
  | { state: "pending_outgoing" | "pending_incoming" | "connected"; connectionId: string }
  | { state: "cooldown"; days: number };

const NOTE_MAX = 300;

/** Connect button and pop-up on a member profile (FR3.1, US3.1, wireframe P07). */
export function ConnectButton({ memberId, memberName, initial }: { memberId: string; memberName: string; initial: RelationshipView }) {
  const router = useRouter();
  const [rel, setRel] = useState(initial);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function openDialog() {
    setOpen(true);
    setError(null);
    const result = await getJson<{ remaining: number }>("/api/v1/connections/allowance");
    if (result.ok) setLeft(result.data.remaining);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return setError("Say briefly why you are reaching out");
    setSending(true);
    const result = await postJson<{ id: string; remainingToday: number }>("/api/v1/connections", { recipientId: memberId, note });
    setSending(false);
    if (!result.ok) {
      const details = result.error.details as { message: string }[] | undefined;
      return setError(details?.[0]?.message ?? result.error.message);
    }
    setRel({ state: "pending_outgoing", connectionId: result.data.id });
    setOpen(false);
    toast.success(`Request sent to ${memberName}`);
    router.refresh();
  }

  switch (rel.state) {
    case "self":
    case "blocked":
      return null;
    case "pending_outgoing":
      return (
        <Button disabled variant="outline">
          <Clock aria-hidden /> Request sent
        </Button>
      );
    case "pending_incoming":
      return (
        <Link href="/requests" className={buttonVariants()}>
          Respond to request
        </Link>
      );
    case "connected":
      return (
        <>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden className="size-4" /> Connected
          </span>
          <Link href={`/messages/${rel.connectionId}`} className={buttonVariants()}>
            <MessageCircle aria-hidden /> Message
          </Link>
        </>
      );
    case "cooldown":
      return (
        <Button disabled variant="outline" title="You asked this member recently">
          Ask again in {rel.days} {rel.days === 1 ? "day" : "days"}
        </Button>
      );
  }

  return (
    <>
      <Button onClick={openDialog}>
        <UserPlus aria-hidden /> Connect
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={send} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Connect with {memberName}</DialogTitle>
              <DialogDescription>
                A short note helps them decide. If they accept, you can chat and see each other&apos;s email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="connect-note">Why are you reaching out?</Label>
                <span className={cn("text-xs", note.length > NOTE_MAX ? "text-destructive" : "text-muted-foreground")}>
                  {note.length}/{NOTE_MAX}
                </span>
              </div>
              <Textarea
                id="connect-note"
                rows={4}
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => (setNote(e.target.value), setError(null))}
                placeholder="e.g. I am taking CSE341 next semester and saw you can advise on it."
              />
            </div>
            {left !== null ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {left} {left === 1 ? "request" : "requests"} left today
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || left === 0}>
                {sending ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
