import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { initialsOf } from "@/lib/navigation";
import type { InboxItem, InboxView } from "@/lib/services/connections";
import { RespondButtons } from "./respond-buttons";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** One request in the inbox (FR3.3, wireframe P08). */
export function InboxRow({ item, view, avatarUrl }: { item: InboxItem; view: InboxView; avatarUrl: string | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar className="size-10">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{initialsOf(item.person.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/members/${item.person.id}`} className="font-semibold hover:underline">
                {item.person.name}
              </Link>
              <span className="text-xs text-muted-foreground">{when(item.respondedAt && view === "accepted" ? item.respondedAt : item.createdAt)}</span>
            </div>
            {item.viaPost ? <Badge variant="outline">via your post: {item.viaPost.title}</Badge> : null}
            <p className="text-sm break-words text-muted-foreground">“{item.note}”</p>
            {item.email ? (
              <a href={`mailto:${item.email}`} className="text-sm underline">
                {item.email}
              </a>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          {view === "incoming" ? <RespondButtons connectionId={item.id} name={item.person.name} /> : null}
          {view === "outgoing" ? (
            item.status === "DECLINED" ? (
              <div className="text-right">
                <Badge variant="secondary">Declined</Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.cooldownDays > 0 ? `Can ask again in ${item.cooldownDays} ${item.cooldownDays === 1 ? "day" : "days"}` : "Can ask again"}
                </p>
              </div>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )
          ) : null}
          {view === "accepted" ? (
            <Link href={`/messages/${item.id}`} className={buttonVariants({ size: "sm" })}>
              <MessageCircle aria-hidden /> Message
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
