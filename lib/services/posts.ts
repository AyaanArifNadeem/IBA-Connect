import "server-only";
import { z } from "zod";
import { validationFailed } from "@/lib/api/errors";
import { BODY_MAX, POST_LIFETIME_DAYS, POST_TYPES, TITLE_MAX } from "@/lib/board";
import { DEPARTMENTS } from "@/lib/constants/academics";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

/** A need post (FR4.1): type, title and details required; an optional course OR department tag. */
export const postSchema = z
  .object({
    type: z.enum(POST_TYPES, { error: "Choose the kind of help you need" }),
    title: z.string().trim().min(3, "Give your post a title").max(TITLE_MAX, `The title can be at most ${TITLE_MAX} characters`),
    body: z.string().trim().min(1, "Add some details").max(BODY_MAX, `The details can be at most ${BODY_MAX.toLocaleString("en")} characters`),
    course: z.string().trim().toUpperCase().max(12).nullish().transform((v) => v || null),
    department: z.enum(DEPARTMENTS, { error: "Unknown department" }).nullish().transform((v) => v ?? null),
  })
  .refine((p) => !(p.course && p.department), {
    path: ["department"],
    message: "Tag a course or a department, not both",
  });

export type PostInput = z.infer<typeof postSchema>;

/** Look up the course tag; it must be on the course list and not retired. */
export async function resolveCourseTag(code: string | null): Promise<string | null> {
  if (!code) return null;
  const course = await db.course.findFirst({ where: { code, retiredAt: null }, select: { id: true } });
  if (!course) throw validationFailed([{ path: "course", message: "Choose a course from the list" }]);
  return course.id;
}

/** Publish a post (FR4.1). It is open to every verified member and expires after 14 days (FR4.4). */
export async function createPost(authorId: string, input: PostInput, now = new Date()) {
  const courseId = await resolveCourseTag(input.course);
  await enforceRateLimit({
    key: `post:${authorId}`,
    limit: 10,
    windowMs: 86_400_000,
    userId: authorId,
    message: "You can publish up to 10 posts a day.",
  });
  return db.post.create({
    data: {
      authorId,
      type: input.type,
      title: input.title,
      body: input.body,
      courseId,
      departmentTag: input.department,
      createdAt: now,
      expiresAt: new Date(now.getTime() + POST_LIFETIME_DAYS * 86_400_000),
    },
  });
}
