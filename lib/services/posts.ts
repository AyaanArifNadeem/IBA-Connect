import "server-only";
import { z } from "zod";
import { badRequest, conflict, notFound, validationFailed } from "@/lib/api/errors";
import { BODY_MAX, POST_LIFETIME_DAYS, POST_TYPE_SLUGS, POST_TYPES, TITLE_MAX, type PostTypeValue } from "@/lib/board";
import { DEPARTMENTS } from "@/lib/constants/academics";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PostStatus, UserStatus } from "@/lib/generated/prisma/enums";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendRequest } from "./connections";

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

// ------------------------------------------------------------------ browse (FR4.2)

export const BOARD_PAGE_SIZE = 20;

const slugToType = Object.fromEntries(Object.entries(POST_TYPE_SLUGS).map(([type, slug]) => [slug, type])) as Record<string, PostTypeValue>;

export const boardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  type: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const type = slugToType[v];
      if (!type) ctx.addIssue({ code: "custom", message: "Unknown post type" });
      return type;
    }),
  course: z.string().trim().toUpperCase().max(12).optional(),
  department: z.enum(DEPARTMENTS, { error: "Unknown department" }).optional(),
  q: z.string().trim().max(100, "Search is too long").optional(),
});

export type BoardQuery = z.infer<typeof boardQuerySchema>;

/** Open means not closed and not yet expired (FR4.4). Expiry is checked at read time, so no job is needed. */
export const openPostWhere = (now = new Date()): Prisma.PostWhereInput => ({ status: PostStatus.OPEN, expiresAt: { gt: now } });

/** Open posts from active members, newest first, filtered by type, tag and words (FR4.2, US4.2). */
export async function listOpenPosts(viewerId: string, query: BoardQuery, now = new Date()) {
  const words = (query.q ?? "").split(/\s+/).filter((w) => w.length >= 2).slice(0, 6);
  const where: Prisma.PostWhereInput = {
    AND: [
      openPostWhere(now),
      { author: { status: UserStatus.ACTIVE, deletedAt: null } },
      query.type ? { type: query.type } : {},
      query.course ? { course: { code: query.course } } : {},
      query.department ? { departmentTag: query.department } : {},
      ...words.map((w) => ({ OR: [{ title: { contains: w, mode: "insensitive" as const } }, { body: { contains: w, mode: "insensitive" as const } }] })),
    ],
  };
  const [total, rows] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * BOARD_PAGE_SIZE,
      take: BOARD_PAGE_SIZE,
      include: {
        author: { select: { id: true, name: true, avatarPath: true } },
        course: { select: { code: true } },
        _count: { select: { responses: true } },
        responses: { where: { responderId: viewerId }, select: { id: true }, take: 1 },
      },
    }),
  ]);
  return {
    page: query.page,
    pages: Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE)),
    total,
    posts: rows.map((p) => ({
      id: p.id,
      type: p.type as PostTypeValue,
      title: p.title,
      body: p.body,
      courseCode: p.course?.code ?? null,
      departmentTag: p.departmentTag,
      createdAt: p.createdAt.toISOString(),
      expiresAt: p.expiresAt.toISOString(),
      author: { id: p.author.id, name: p.author.name, avatarPath: p.author.avatarPath },
      mine: p.authorId === viewerId,
      responses: p._count.responses,
      respondedByMe: p.responses.length > 0,
    })),
  };
}

export type BoardPost = Awaited<ReturnType<typeof listOpenPosts>>["posts"][number];

// ------------------------------------------------------------- respond (FR4.3)

export const responseSchema = z.object({
  message: z.string().trim().min(1, "Write a short reply").max(300, "The reply can be at most 300 characters"),
});

/**
 * Respond to a post (FR4.3, US4.3): opens a connection request to the author carrying the post,
 * with the same limits, cooldown and block rules as any request (FR3.1).
 */
export async function respondToPost(responder: { id: string; name: string }, postId: string, message: string, now = new Date()) {
  const post = await db.post.findFirst({
    where: { id: postId, author: { status: UserStatus.ACTIVE, deletedAt: null } },
    select: { id: true, authorId: true, title: true, status: true, expiresAt: true },
  });
  if (!post) throw notFound("This post could not be found.");
  if (post.authorId === responder.id) throw badRequest("You cannot respond to your own post.");
  if (post.status !== PostStatus.OPEN || post.expiresAt <= now) throw conflict("This post is closed and no longer takes responses.");
  if (await db.postResponse.findUnique({ where: { postId_responderId: { postId, responderId: responder.id } } })) {
    throw conflict("You already responded to this post.");
  }

  const { connection, remaining } = await sendRequest(
    responder,
    { recipientId: post.authorId, note: message, originPostId: post.id, postTitle: post.title },
    now,
  );
  try {
    const response = await db.postResponse.create({
      data: { postId, responderId: responder.id, message, connectionId: connection.id, createdAt: now },
    });
    return { response, connection, remaining };
  } catch (err) {
    // Responded twice at the same moment: keep one response and drop the extra request
    await db.connection.delete({ where: { id: connection.id } }).catch(() => {});
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") throw conflict("You already responded to this post.");
    throw err;
  }
}
