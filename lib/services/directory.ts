import "server-only";
import { z } from "zod";
import { ALUMNI_FIELDS, DEPARTMENTS, PROGRAMMES } from "@/lib/constants/academics";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { avatarUrls } from "@/lib/storage/avatars";

export const PAGE_SIZE = 18;

/** One value or several (?course=A&course=B), always returned as a list. */
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(item).max(5));
const flag = z.preprocess((v) => v === "1" || v === "true" || v === "on", z.boolean());

/** Directory query: paging (FR2.1), free-text search (FR2.2) and filters (FR2.3). */
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(100, "Search is too long").optional(),
  // Filters in the client's priority order (FR2.3)
  course: list(z.string().trim().toUpperCase().max(12)),
  skill: list(z.string().trim().max(40)),
  advise: flag.default(false),
  batch: z.coerce.number({ error: "Batch must be a year" }).int().min(1960).max(2100).optional(),
  department: z.enum(DEPARTMENTS, { error: "Unknown department" }).optional(),
  programme: z.enum(PROGRAMMES, { error: "Unknown programme" }).optional(),
  // Alumni filters (US2.5); choosing a field or company implies alumni only
  alumni: flag.default(false),
  field: z.enum(ALUMNI_FIELDS, { error: "Unknown field" }).optional(),
  company: z.string().trim().max(80).optional(),
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

/**
 * Filters (FR2.3): every chosen filter must match. With "available to advise" and a course,
 * the member must advise on that course (US2.4); with no course, advising on anything counts.
 */
export function filterWhere(query: DirectoryQuery): Prisma.UserWhereInput[] {
  const and: Prisma.UserWhereInput[] = [];
  for (const code of query.course) {
    and.push({
      courses: { some: { course: { code }, ...(query.advise ? { canAdvise: true } : {}) } },
    });
  }
  for (const skill of query.skill) {
    and.push({ skills: { some: { skill: { name: { equals: skill, mode: "insensitive" } } } } });
  }
  if (query.advise) and.push({ availableToAdvise: true });
  if (query.batch) and.push({ batch: query.batch });
  if (query.department) and.push({ department: query.department });
  if (query.programme) and.push({ programme: query.programme });
  if (query.alumni || query.field || query.company) and.push({ role: Role.ALUMNUS });
  if (query.field) and.push({ field: query.field });
  if (query.company) and.push({ company: { contains: query.company, mode: "insensitive" } });
  return and;
}

/** Number of filters in use (shown on the phone "Filters (n)" button). */
export function activeFilterCount(query: DirectoryQuery): number {
  return filterWhere(query).length;
}

/** All the conditions for a directory query. */
export function directoryWhere(query: DirectoryQuery): Prisma.UserWhereInput {
  return { AND: [searchWhere(query.q), ...filterWhere(query)] };
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
