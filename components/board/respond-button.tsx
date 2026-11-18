"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { POST_TYPE_LABELS, type PostTypeValue } from "@/lib/board";
import { getJson, postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const MAX = 300;

type Props = {
  post: { id: string; type: PostTypeValue; title: string; authorName: string };
  responded: boolean;
};

/** Respond pop-up on the board (FR4.3, US4.3, wireframe P11-B). Sends a connection request with the post attached. */
export function RespondButton({ post, responded: initiallyResponded }: Props) {
  const router = useRouter();
  const [responded, setResponded] = useState(initiallyResponded);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (responded) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <Check aria-hidden className="size-4" /> Responded
      </span>
    );
  }

  async function openDialog() {
    setOpen(true);
    setError(null);
    const result = await getJson<{ remaining: number }>("/api/v1/connections/allowance");
    if (result.ok) setLeft(result.data.remaining);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return setError("Write a short reply");
    setSending(true);
    const result = await postJson(`/api/v1/posts/${post.id}/responses`, { message });
    setSending(false);
    if (!result.ok) {
      const details = result.error.details as { message: string }[] | undefined;
      return setError(details?.[0]?.message ?? result.error.message);
    }
    setResponded(true);
    setOpen(false);
    toast.success(`Sent to ${post.authorName}. You will find it in Requests.`);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={openDialog} aria-label={`Respond to ${post.title}`}>
        Respond
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={send} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Respond to {post.authorName}&apos;s post</DialogTitle>
              <DialogDescription>Your reply is sent as a connection request with this post attached.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 rounded-lg border border-dashed p-3">
              <Badge>{POST_TYPE_LABELS[post.type]}</Badge>
              <p className="text-sm font-medium">{post.title}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={`reply-${post.id}`}>Your reply</Label>
                <span className={cn("text-xs", message.length > MAX ? "text-destructive" : "text-muted-foreground")}>
                  {message.length}/{MAX}
                </span>
              </div>
              <Textarea id={`reply-${post.id}`} rows={4} maxLength={MAX} value={message} onChange={(e) => (setMessage(e.target.value), setError(null))} />
            </div>
            {left !== null ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                Sent as a connection request · {left} left today
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
                {sending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
