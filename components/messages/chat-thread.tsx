"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getJson, postJson } from "@/lib/client/api";
import { initialsOf } from "@/lib/navigation";
import type { ChatMessage } from "@/lib/services/messages";
import { cn } from "@/lib/utils";

export const MESSAGE_MAX = 2000;

type Props = {
  connectionId: string;
  other: { id: string; name: string; email: string | null; avatarUrl: string | null; deleted: boolean };
  note: string;
  requestedByMe: boolean;
  initialMessages: ChatMessage[];
  pollMs?: number;
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Merge new messages in, by id, keeping time order. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
}

/** Private 1:1 chat (FR3.4, FR3.8, wireframe P09). New messages arrive by polling. */
export function ChatThread({ connectionId, other, note, requestedByMe, initialMessages, pollMs = 5000 }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef(initialMessages.at(-1)?.sentAt);

  useEffect(() => {
    latest.current = messages.at(-1)?.sentAt;
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  const poll = useCallback(async () => {
    const after = latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
    const result = await getJson<ChatMessage[]>(`/api/v1/connections/${connectionId}/messages${after}`);
    if (result.ok && result.data.length) setMessages((m) => mergeMessages(m, result.data));
  }, [connectionId]);

  // Poll while the page is visible; check straight away when the member comes back to it
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, pollMs);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, pollMs]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (body.length > MESSAGE_MAX) return setError(`A message can be at most ${MESSAGE_MAX.toLocaleString("en")} characters`);
    setSending(true);
    const result = await postJson<ChatMessage>(`/api/v1/connections/${connectionId}/messages`, { body });
    setSending(false);
    if (!result.ok) {
      const details = result.error.details as { message: string }[] | undefined;
      return setError(details?.[0]?.message ?? result.error.message);
    }
    setDraft("");
    setError(null);
    setMessages((m) => mergeMessages(m, [result.data]));
  }

  return (
    <section className="flex h-[calc(100dvh-11rem)] min-h-[24rem] flex-col md:h-[calc(100dvh-8.5rem)]" aria-label={`Chat with ${other.name}`}>
      <header className="flex items-center gap-3 border-b px-3 py-2">
        <Link href="/messages" className="rounded p-1 hover:bg-muted md:hidden" aria-label="Back to chats">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar className="size-9">
          {other.avatarUrl ? <AvatarImage src={other.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initialsOf(other.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {other.deleted ? (
            <p className="font-semibold">{other.name}</p>
          ) : (
            <Link href={`/members/${other.id}`} className="font-semibold hover:underline">
              {other.name}
            </Link>
          )}
          {other.email ? <p className="truncate text-xs text-muted-foreground">{other.email}</p> : null}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="Messages">
        <p className="mx-auto w-fit max-w-[90%] rounded-lg border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
          {requestedByMe ? "Your request" : "Request"} note: “{note}”
        </p>
        {messages.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                m.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-background",
              )}
            >
              <span className="sr-only">{m.mine ? "You" : other.name}: </span>
              {m.body}
              <span className={cn("mt-1 block text-right text-[10px]", m.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                <time dateTime={m.sentAt}>{clock(m.sentAt)}</time>
              </span>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {other.deleted ? (
        <p className="border-t p-3 text-center text-sm text-muted-foreground">This member has left IBA Connect.</p>
      ) : (
        <form onSubmit={send} className="space-y-1 border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Write a message"
              placeholder="Write a message… (text only)"
              rows={1}
              value={draft}
              maxLength={MESSAGE_MAX + 100}
              onChange={(e) => (setDraft(e.target.value), setError(null))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="max-h-40 min-h-10 resize-none"
            />
            <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send">
              <Send aria-hidden />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <div className="flex justify-between text-xs">
            <span role="alert" className="text-destructive">
              {error}
            </span>
            <span className={cn(draft.length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground")}>
              {draft.length}/{MESSAGE_MAX}
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
