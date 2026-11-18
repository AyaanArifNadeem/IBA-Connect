import "server-only";
import { validationFailed } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { Role } from "@/lib/generated/prisma/enums";
import { skillSlug, type ProfileInput } from "@/lib/validation/profile";

/** The signed-in member's own profile, with skills and courses (the edit form's data). */
export async function getOwnProfile(memberId: string) {
  const member = await db.user.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      skills: { include: { skill: true } },
      courses: { include: { course: true }, orderBy: { course: { code: "asc" } } },
    },
  });
  return {
    id: member.id,
    email: member.email,
    role: member.role,
    name: member.name,
    batch: member.batch,
    programme: member.programme,
    department: member.department,
    semester: member.semester,
    bio: member.bio ?? "",
    availableToAdvise: member.availableToAdvise,
    field: member.field,
    company: member.company,
    profileCompleted: Boolean(member.profileCompletedAt),
    skills: member.skills.map((s) => s.skill.name).sort((a, b) => a.localeCompare(b)),
    courses: member.courses.map((c) => ({
      id: c.course.id,
      code: c.course.code,
      title: c.course.title,
      canAdvise: c.canAdvise,
    })),
  };
}

export type OwnProfile = Awaited<ReturnType<typeof getOwnProfile>>;

/**
 * Save the profile (FR1.4). Skills are matched to the shared list by name (new ones are
 * added); courses must exist and not be retired. The first save completes profile setup.
 */
export async function saveProfile(member: { id: string; role: Role; profileCompletedAt: Date | null }, input: ProfileInput) {
  const isAlumnus = member.role === Role.ALUMNUS;
  if (!isAlumnus && (input.semester === null || input.semester === undefined)) {
    throw validationFailed([{ path: "semester", message: "Choose your current semester" }]);
  }

  const courseIds = [...new Set(input.courseIds)];
  if (courseIds.length) {
    const found = await db.course.findMany({ where: { id: { in: courseIds }, retiredAt: null }, select: { id: true } });
    if (found.length !== courseIds.length) {
      throw validationFailed([{ path: "courseIds", message: "One of the courses is not available. Please choose again." }]);
    }
  }

  return db.$transaction(async (tx) => {
    // Shared skill list: reuse existing skills, add new ones
    const skills = await Promise.all(
      input.skills.map((name) =>
        tx.skill.upsert({ where: { slug: skillSlug(name) }, update: {}, create: { name, slug: skillSlug(name) } }),
      ),
    );

    // Keep the advise flag on courses the member keeps (US1.8)
    const kept = await tx.userCourse.findMany({ where: { userId: member.id, courseId: { in: courseIds } } });
    const canAdvise = new Map(kept.map((c) => [c.courseId, c.canAdvise]));

    await tx.userSkill.deleteMany({ where: { userId: member.id } });
    await tx.userCourse.deleteMany({ where: { userId: member.id } });

    return tx.user.update({
      where: { id: member.id },
      data: {
        name: input.name,
        batch: input.batch,
        programme: input.programme,
        department: input.department,
        semester: isAlumnus ? null : input.semester,
        bio: input.bio,
        profileCompletedAt: member.profileCompletedAt ?? new Date(),
        skills: { create: skills.map((s) => ({ skillId: s.id })) },
        courses: { create: courseIds.map((id) => ({ courseId: id, canAdvise: canAdvise.get(id) ?? false })) },
      },
    });
  });
}

/** Active courses for pickers, optionally filtered by code or title. */
export function listCourses(query?: string) {
  const q = query?.trim();
  return db.course.findMany({
    where: {
      retiredAt: null,
      ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, code: true, title: true, department: true },
    orderBy: { code: "asc" },
    take: 100,
  });
}

/** Skill suggestions for the skills field. */
export function suggestSkills(query?: string) {
  const q = query?.trim();
  return db.skill.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    select: { name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}
