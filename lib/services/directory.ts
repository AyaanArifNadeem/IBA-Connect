import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { avatarUrls } from "@/lib/storage/avatars";

export const PAGE_SIZE = 18;

/** Directory query (FR2.1) with free-text search (FR2.2). Filters are added by FR2.3. */
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(100, "Search is too long").optional(),
});

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

/** Only verified members with a finished, active profile appear in the directory. */
export function visibleMembers(viewerId: string): Prisma.UserWhereInput {
  return {
    id: { not: viewerId },
    status: UserStatus.ACTIVE,
    deletedAt: null,
    profileCompletedAt: { not: null },
  };
}

/** Words of a search, ignoring very short ones and duplicates; at most 6. */
export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  const words = q.toLowerCase().split(/[\s,]+/).map((w) => w.trim()).filter((w) => w.length >= 2);
  return [...new Set(words)].slice(0, 6);
}

/**
 * Free-text search (FR2.2): every word must match the member's name, one of their skills, or
 * one of their courses (code or title). Partial words match ("pyth" finds Python); trigram
 * indexes keep this fast (NFR1).
 */
export function searchWhere(q: string | undefined): Prisma.UserWhereInput {
  const terms = searchTerms(q);
  if (terms.length === 0) return {};
  return {
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { skills: { some: { skill: { name: { contains: term, mode: "insensitive" } } } } },
        {
          courses: {
            some: {
              course: {
                OR: [
                  { code: { contains: term.replace(/\s/g, ""), mode: "insensitive" } },
                  { title: { contains: term, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    })),
  };
}

/** All the conditions for a directory query. */
export function directoryWhere(query: DirectoryQuery): Prisma.UserWhereInput {
  return searchWhere(query.q);
}

/**
 * One page of member cards. Never includes an email or any other contact detail (FR2.1, NFR10):
 * the select below is the only place card data comes from.
 */
export async function listMembers(viewerId: string, query: DirectoryQuery) {
  const filter: Prisma.UserWhereInput = { AND: [visibleMembers(viewerId), directoryWhere(query)] };
  const [total, rows] = await Promise.all([
    db.user.count({ where: filter }),
    db.user.findMany({
      where: filter,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        role: true,
        avatarPath: true,
        batch: true,
        programme: true,
        department: true,
        availableToAdvise: true,
        field: true,
        company: true,
        skills: { select: { skill: { select: { name: true } } }, take: 4 },
        courses: { where: { canAdvise: true }, select: { course: { select: { code: true } } } },
      },
    }),
  ]);

  const urls = await avatarUrls(rows.map((r) => r.avatarPath));
  return {
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    members: rows.map((r) => ({
      id: r.id,
      name: r.name,
      isAlumnus: r.role === Role.ALUMNUS,
      avatarUrl: r.avatarPath ? (urls.get(r.avatarPath) ?? null) : null,
      batch: r.batch,
      programme: r.programme,
      department: r.department,
      field: r.role === Role.ALUMNUS ? r.field : null,
      company: r.role === Role.ALUMNUS ? r.company : null,
      skills: r.skills.map((s) => s.skill.name),
      adviseCourses: r.availableToAdvise ? r.courses.map((c) => c.course.code).sort() : [],
    })),
  };
}

export type DirectoryPage = Awaited<ReturnType<typeof listMembers>>;
export type MemberCardData = DirectoryPage["members"][number];
