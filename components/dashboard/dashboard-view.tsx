import { ClipboardList, MessageCircle, Plus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StateBadge } from "@/components/board/my-post-list";
import { RespondButtons } from "@/components/requests/respond-buttons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POST_TYPE_LABELS } from "@/lib/board";
import { initialsOf } from "@/lib/navigation";
import type { Dashboard } from "@/lib/services/dashboard";

function Stat({ href, value, label, icon }: { href: string; value: number; label: string; icon: ReactNode }) {
  return (
    <Link href={href} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
          <span aria-hidden className="text-muted-foreground">
            {icon}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function Section({ title, count, href, linkLabel, children }: { title: string; count: number; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {title}
          {count ? <Badge>{count}</Badge> : null}
        </CardTitle>
        <Link href={href} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {linkLabel}
        </Link>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Dashboard after sign-in (FR1.7, wireframe P04). Every main screen is one click away (NFR14). */
export function DashboardView({ name, data }: { name: string; data: Dashboard }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hi {name.split(" ")[0]}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/directory" className={buttonVariants({ variant: "outline" })}>
            <Users aria-hidden /> Find people
          </Link>
          <Link href="/board/new" className={buttonVariants()}>
            <Plus aria-hidden /> Post a need
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat href="/requests" value={data.counts.pendingRequests} label="Pending requests" icon={<UserPlus className="size-6" />} />
        <Stat href="/messages" value={data.counts.unreadMessages} label="Unread messages" icon={<MessageCircle className="size-6" />} />
        <Stat href="/board/my-posts" value={data.counts.openPosts} label="My open posts" icon={<ClipboardList className="size-6" />} />
        <Stat href="/requests?view=accepted" value={data.counts.connections} label="Connections" icon={<Users className="size-6" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Pending requests" count={data.counts.pendingRequests} href="/requests" linkLabel="All requests">
          {data.pendingRequests.length ? (
            <ul className="divide-y">
              {data.pendingRequests.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarFallback>{initialsOf(r.person.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Link href={`/members/${r.person.id}`} className="font-medium hover:underline">
                        {r.person.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{r.viaPost ? `via your post: ${r.viaPost.title}` : r.note}</p>
                    </div>
                  </div>
                  <RespondButtons connectionId={r.id} name={r.person.name} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No one is waiting for an answer.</Empty>
          )}
        </Section>

        <Section title="Unread messages" count={data.counts.unreadMessages} href="/messages" linkLabel="All chats">
          {data.unreadChats.length ? (
            <ul className="divide-y">
              {data.unreadChats.map((c) => (
                <li key={c.id}>
                  <Link href={`/messages/${c.id}`} className="flex items-center gap-2 py-2 hover:underline">
                    <Avatar className="size-8">
                      <AvatarFallback>{initialsOf(c.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.lastMessage?.preview}</span>
                    </span>
                    <Badge aria-label={`${c.unread} unread`}>{c.unread}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>You are all caught up.</Empty>
          )}
        </Section>

        <Section title="My open need posts" count={data.counts.openPosts} href="/board/my-posts" linkLabel="My posts">
          {data.openPosts.length ? (
            <ul className="divide-y">
              {data.openPosts.map((p) => (
                <li key={p.id}>
                  <Link href={`/board/my-posts/${p.id}`} className="flex flex-wrap items-center gap-2 py-2 hover:underline">
                    <Badge variant="outline">{POST_TYPE_LABELS[p.type]}</Badge>
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <StateBadge state={p.state} expiresAt={p.expiresAt} />
                    <span className="text-xs text-muted-foreground">
                      {p.responses} {p.responses === 1 ? "response" : "responses"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              No open posts.{" "}
              <Link href="/board/new" className="font-medium text-primary underline">
                Post a need
              </Link>
            </Empty>
          )}
        </Section>

        <Card>
          <CardHeader>
            <CardTitle>Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              ["/directory", "Directory"],
              ["/board", "Need Board"],
              ["/messages", "Messages"],
              ["/requests", "Requests"],
              ["/profile", "My profile"],
              ["/settings", "Settings"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
