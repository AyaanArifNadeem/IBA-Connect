import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardTabs } from "@/components/board/board-tabs";
import { ClosePostButton } from "@/components/board/close-post-button";
import { MyPostList, StateBadge } from "@/components/board/my-post-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { POST_TYPE_LABELS } from "@/lib/board";
import { initialsOf } from "@/lib/navigation";
import { getMyPost, listMyPosts } from "@/lib/services/posts";
import { avatarUrls } from "@/lib/storage/avatars";

export const metadata: Metadata = { title: "My post · IBA Connect" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** My post and its responses (FR4.4, US4.4, US4.5, wireframe P12). */
export default async function MyPostPage({ params }: PageProps<"/board/my-posts/[id]">) {
  const member = await requireCompletedProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [post, posts] = await Promise.all([
    getMyPost(member.id, id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    }),
    listMyPosts(member.id),
  ]);
  const avatars = await avatarUrls(post.responses.map((r) => r.responder.avatarPath));
  const tag = post.courseCode ?? post.departmentTag;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Need Board</h1>
      <BoardTabs active="mine" />

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside className="order-2 md:order-1">
          <MyPostList posts={posts} activeId={post.id} />
        </aside>

        <div className="order-1 min-w-0 space-y-5 md:order-2">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{POST_TYPE_LABELS[post.type]}</Badge>
                  {tag ? <Badge variant="outline">{tag}</Badge> : null}
                  <StateBadge state={post.state} expiresAt={post.expiresAt} />
                </div>
                {post.state === "open" ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/board/my-posts/${post.id}/edit`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      Edit
                    </Link>
                    <ClosePostButton postId={post.id} />
                  </div>
                ) : null}
              </div>
              <h2 className="text-xl font-bold break-words">{post.title}</h2>
              <p className="whitespace-pre-line break-words text-muted-foreground">{post.body}</p>
              {post.state !== "open" ? (
                <p className="text-sm text-muted-foreground">
                  This post is {post.state} and no longer on the board. You can still see the responses below.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <section aria-labelledby="responses-heading" className="space-y-3">
            <h3 id="responses-heading" className="text-lg font-semibold">
              Responses ({post.responses.length})
            </h3>
            {post.responses.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No responses yet.</p>
            ) : (
              <ul className="space-y-2">
                {post.responses.map((r) => (
                  <li key={r.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Avatar className="size-9">
                            {r.responder.avatarPath && avatars.get(r.responder.avatarPath) ? <AvatarImage src={avatars.get(r.responder.avatarPath)} alt="" /> : null}
                            <AvatarFallback>{initialsOf(r.responder.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link href={`/members/${r.responder.id}`} className="font-medium hover:underline">
                              {r.responder.name}
                            </Link>
                            <p className="text-sm break-words text-muted-foreground">“{r.message}”</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {r.connectionStatus === "PENDING" ? (
                            <>
                              <Badge variant="outline">Pending</Badge>
                              <Link href="/requests" className={buttonVariants({ size: "sm" })}>
                                Accept / decline
                              </Link>
                            </>
                          ) : r.connectionStatus === "ACCEPTED" ? (
                            <>
                              <Badge variant="secondary">Connected</Badge>
                              <Link href={`/messages/${r.connectionId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                                <MessageCircle aria-hidden /> Message
                              </Link>
                            </>
                          ) : (
                            <Badge variant="outline">Declined</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
