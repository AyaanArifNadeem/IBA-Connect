import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/board/post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { getMyPost } from "@/lib/services/posts";
import { listCourses } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Edit post · IBA Connect" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Edit your own open post (FR4.5, wireframe P11 "Edit post"). */
export default async function EditPostPage({ params }: PageProps<"/board/my-posts/[id]/edit">) {
  const member = await requireCompletedProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const post = await getMyPost(member.id, id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  if (post.state !== "open") {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="text-xl font-bold">This post can no longer be edited</h1>
        <p className="text-muted-foreground">Closed and expired posts stay as they were.</p>
        <Link href={`/board/my-posts/${post.id}`} className="text-sm font-medium text-primary underline">
          Back to the post
        </Link>
      </div>
    );
  }

  const courses = await listCourses();
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Edit post</CardTitle>
      </CardHeader>
      <CardContent>
        <PostForm
          postId={post.id}
          courses={courses.map((c) => ({ code: c.code, title: c.title }))}
          initial={{ type: post.type, title: post.title, body: post.body, course: post.courseCode ?? "", department: post.departmentTag ?? "" }}
        />
      </CardContent>
    </Card>
  );
}
