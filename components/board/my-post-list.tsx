import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { daysLeft } from "@/lib/board";
import type { MyPostSummary } from "@/lib/services/posts";
import { cn } from "@/lib/utils";

/** Your posts with their state (wireframe P12, left column). */
export function MyPostList({ posts, activeId }: { posts: MyPostSummary[]; activeId?: string }) {
  if (!posts.length) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        You have not posted yet.{" "}
        <Link href="/board/new" className="font-medium text-primary underline">
          Post a need
        </Link>
      </p>
    );
  }
  return (
    <ul className="space-y-2" aria-label="My posts">
      {posts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/board/my-posts/${p.id}`}
            aria-current={p.id === activeId ? "page" : undefined}
            className={cn("block rounded-lg border p-3 hover:bg-muted/60", p.id === activeId && "border-primary bg-muted")}
          >
            <p className="truncate text-sm font-medium">{p.title}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <StateBadge state={p.state} expiresAt={p.expiresAt} />
              <span>
                {p.responses} {p.responses === 1 ? "response" : "responses"}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StateBadge({ state, expiresAt }: { state: MyPostSummary["state"]; expiresAt: string }) {
  if (state === "open") {
    const left = daysLeft(expiresAt);
    return <Badge className="bg-emerald-600 text-white">Open · {left} {left === 1 ? "day" : "days"}</Badge>;
  }
  return <Badge variant="outline">{state === "closed" ? "Closed" : "Expired"}</Badge>;
}
