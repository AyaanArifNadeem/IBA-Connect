import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/board/board-tabs";
import { MyPostList } from "@/components/board/my-post-list";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { listMyPosts } from "@/lib/services/posts";

export const metadata: Metadata = { title: "My posts · IBA Connect" };

/** My posts (wireframe P12): opens the newest post, or shows how to post the first one. */
export default async function MyPostsPage() {
  const member = await requireCompletedProfile();
  const posts = await listMyPosts(member.id);
  if (posts.length) redirect(`/board/my-posts/${posts[0].id}`);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Need Board</h1>
      <BoardTabs active="mine" />
      <MyPostList posts={posts} />
    </div>
  );
}
