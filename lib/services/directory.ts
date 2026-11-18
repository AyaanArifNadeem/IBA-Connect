import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { avatarUrls } from "@/lib/storage/avatars";

export const PAGE_SIZE = 18;

/** Directory query (FR2.1). Search and filters are added by FR2.2 and FR2.3. */
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
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

/**
 * One page of member cards. Never includes an email or any other contact detail (FR2.1, NFR10):
 * the select below is the only place card data comes from.
 */
export async function listMembers(viewerId: string, query: DirectoryQuery, where: Prisma.UserWhereInput = {}) {
  const filter: Prisma.UserWhereInput = { AND: [visibleMembers(viewerId), where] };
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
