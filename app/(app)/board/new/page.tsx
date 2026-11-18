import type { Metadata } from "next";
import { PostForm } from "@/components/board/post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { listCourses } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Post a need · IBA Connect" };

/** Post a need (FR4.1, US4.1, wireframe P11-A). */
export default async function NewPostPage() {
  await requireCompletedProfile();
  const courses = await listCourses();
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Post a need</CardTitle>
      </CardHeader>
      <CardContent>
        <PostForm courses={courses.map((c) => ({ code: c.code, title: c.title }))} />
      </CardContent>
    </Card>
  );
}
