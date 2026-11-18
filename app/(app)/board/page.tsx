import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BoardFilters } from "@/components/board/board-filters";
import { BoardTabs } from "@/components/board/board-tabs";
import { PostCard } from "@/components/board/post-card";
import { RespondButton } from "@/components/board/respond-button";
import { Pager } from "@/components/directory/pager";
import { buttonVariants } from "@/components/ui/button";
import { paramsToObject } from "@/lib/api/validation";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { boardQuerySchema, listOpenPosts } from "@/lib/services/posts";
import { listCourses } from "@/lib/services/profile";
import { avatarUrls } from "@/lib/storage/avatars";

export const metadata: Metadata = { title: "Need Board · IBA Connect" };

/** The Need Board: open posts with filters (FR4.2, US4.2, wireframe P10). */
export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const member = await requireCompletedProfile();
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
  );
  const parsed = boardQuerySchema.safeParse(paramsToObject(params));
  const query = parsed.success ? parsed.data : boardQuerySchema.parse({});
  const [result, courses] = await Promise.all([listOpenPosts(member.id, query), listCourses()]);
  const avatars = await avatarUrls(result.posts.map((p) => p.author.avatarPath));
  const filtered = Boolean(query.type || query.course || query.department || query.q);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Need Board</h1>
        <Link href="/board/new" className={buttonVariants()}>
          <Plus aria-hidden /> Post a need
        </Link>
      </div>

      <BoardTabs active="open" />

      <BoardFilters
        type={query.type}
        course={query.course}
        department={query.department}
        q={query.q}
        courses={courses.map((c) => ({ code: c.code, title: c.title }))}
      />
      {!parsed.success ? (
        <p role="alert" className="text-sm text-destructive">
          {parsed.error.issues[0]?.message ?? "Some filters were not valid and were ignored."}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.total} open {result.total === 1 ? "post" : "posts"}
      </p>

      {result.posts.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.posts.map((p) => (
            <li key={p.id}>
              <PostCard
                post={p}
                avatarUrl={p.author.avatarPath ? avatars.get(p.author.avatarPath) : null}
                action={
                  p.mine ? (
                    <Link href={`/board/my-posts/${p.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      Manage
                    </Link>
                  ) : (
                    <RespondButton post={{ id: p.id, type: p.type, title: p.title, authorName: p.author.name }} responded={p.respondedByMe} />
                  )
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filtered ? "No open posts match these filters." : "No open posts yet."}{" "}
          <Link href="/board/new" className="font-medium text-primary underline">
            Post a need
          </Link>
        </div>
      )}

      <Pager page={result.page} pages={result.pages} params={params} />
    </div>
  );
}
