import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/navigation";
import type { ConversationSummary } from "@/lib/services/messages";
import { cn } from "@/lib/utils";

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Chats list (wireframe P09, left column). */
export function ConversationList({
  conversations,
  activeId,
  avatars,
}: {
  conversations: ConversationSummary[];
  activeId?: string;
  avatars: Map<string, string>;
}) {
  if (!conversations.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No chats yet. When someone accepts your request, or you accept theirs, you can message them here.{" "}
        <Link href="/directory" className="font-medium text-primary underline">
          Find people
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y" aria-label="Chats">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            href={`/messages/${c.id}`}
            aria-current={c.id === activeId ? "page" : undefined}
            className={cn("flex items-center gap-3 px-3 py-3 hover:bg-muted/60", c.id === activeId && "bg-muted")}
          >
            <Avatar className="size-9">
              {c.avatarPath && avatars.get(c.avatarPath) ? <AvatarImage src={avatars.get(c.avatarPath)} alt="" /> : null}
              <AvatarFallback>{initialsOf(c.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate", c.unread ? "font-bold" : "font-medium")}>{c.name}</span>
                {c.lastMessage ? <span className="shrink-0 text-xs text-muted-foreground">{time(c.lastMessage.sentAt)}</span> : null}
              </div>
              <p className={cn("truncate text-sm", c.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                {c.lastMessage ? `${c.lastMessage.mine ? "You: " : ""}${c.lastMessage.preview}` : "Say hello"}
              </p>
            </div>
            {c.unread ? (
              <span
                className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground"
                aria-label={`${c.unread} unread`}
              >
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
