import "server-only";
import { validationFailed } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { lookupCache } from "@/lib/lookup-cache";
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
  const missing: { path: string; message: string }[] = [];
  if (!isAlumnus && (input.semester === null || input.semester === undefined)) {
    missing.push({ path: "semester", message: "Choose your current semester" });
  }
  // Alumni profiles include field and company (US1.7)
  if (isAlumnus && !input.field) missing.push({ path: "field", message: "Choose your field" });
  if (isAlumnus && !input.company) missing.push({ path: "company", message: "Enter your company or organisation" });
  if (missing.length) throw validationFailed(missing);

  const courseIds = [...new Set(input.courseIds)];
  if (courseIds.length) {
    const found = await db.course.findMany({ where: { id: { in: courseIds }, retiredAt: null }, select: { id: true } });
    if (found.length !== courseIds.length) {
      throw validationFailed([{ path: "courseIds", message: "One of the courses is not available. Please choose again." }]);
    }
  }

  const updated = await db.$transaction(async (tx) => {
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
        field: isAlumnus ? input.field : null,
        company: isAlumnus ? input.company : null,
        profileCompletedAt: member.profileCompletedAt ?? new Date(),
        skills: { create: skills.map((s) => ({ skillId: s.id })) },
        courses: { create: courseIds.map((id) => ({ courseId: id, canAdvise: canAdvise.get(id) ?? false })) },
      },
    });
  });
  // The member may have added a skill nobody had before: the suggestion list must show it
  invalidateSkillList();
  return updated;
}

const courseSelect = { id: true, code: true, title: true, department: true } as const;

function findCourses(query?: string) {
  const q = query?.trim();
  return db.course.findMany({
    where: {
      retiredAt: null,
      ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: courseSelect,
    orderBy: { code: "asc" },
    take: 100,
  });
}

// Every directory, board and profile page loads the unfiltered lists; they change only when an admin
// edits a course or a member adds a new skill, so they are kept for a short while (lib/lookup-cache.ts)
const allCourses = lookupCache(() => findCourses());
const allSkills = lookupCache(() => findSkills());

/** Call after the change has been committed. */
export const invalidateCourseList = () => allCourses.invalidate();
export const invalidateSkillList = () => allSkills.invalidate();

/** Active courses for pickers, optionally filtered by code or title. Only the full list is cached. */
export function listCourses(query?: string) {
  return query?.trim() ? findCourses(query) : allCourses.get();
}

function findSkills(query?: string) {
  const q = query?.trim();
  return db.skill.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    select: { name: true },
    orderBy: { name: "asc" },
    take: q ? 20 : 200,
  });
}

/** Skill suggestions for the skills field. Only the full list is cached. */
export function suggestSkills(query?: string) {
  return query?.trim() ? findSkills(query) : allSkills.get();
}
