import "server-only";
import { z } from "zod";
import { conflict, notFound } from "@/lib/api/errors";
import { DEPARTMENTS } from "@/lib/constants/academics";
import { db } from "@/lib/db";
import { recordAdminAction } from "./audit";
import { invalidateCourseList } from "./profile";

export const courseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}\s?\d{3}[A-Z]?$/, "Use a code like CSE341"),
  title: z.string().trim().min(3, "Enter the course title").max(120, "Title is too long"),
  department: z.enum(DEPARTMENTS, { error: "Choose a department" }),
});

export const courseUpdateSchema = courseSchema.partial().extend({ retired: z.boolean().optional() });

/** All courses, including retired ones, with how many members list each (FR1.10). */
export async function listAllCourses() {
  const rows = await db.course.findMany({
    include: { _count: { select: { takenBy: true } } },
    orderBy: [{ retiredAt: { sort: "asc", nulls: "first" } }, { code: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    department: c.department,
    retired: Boolean(c.retiredAt),
    members: c._count.takenBy,
  }));
}

async function assertCodeFree(code: string, exceptId?: string) {
  const existing = await db.course.findUnique({ where: { code } });
  if (existing && existing.id !== exceptId) throw conflict("Course code already exists.");
}

export async function addCourse(adminId: string, input: z.infer<typeof courseSchema>) {
  const code = input.code.replace(/\s/g, "");
  await assertCodeFree(code);
  const created = await db.$transaction(async (tx) => {
    const course = await tx.course.create({ data: { ...input, code } });
    await recordAdminAction(adminId, "course.add", { type: "course", id: course.id }, { code }, tx);
    return course;
  });
  invalidateCourseList(); // after the commit, so the next read cannot cache the old list
  return created;
}

/**
 * Edit or retire a course. Retired courses are no longer offered in pickers, but members who
 * already list them keep them (FR1.10).
 */
export async function updateCourse(adminId: string, id: string, input: z.infer<typeof courseUpdateSchema>) {
  const course = await db.course.findUnique({ where: { id } });
  if (!course) throw notFound("Course not found.");
  const code = input.code?.replace(/\s/g, "");
  if (code) await assertCodeFree(code, id);

  const { retired, ...fields } = input;
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.course.update({
      where: { id },
      data: {
        ...fields,
        ...(code ? { code } : {}),
        ...(retired === undefined ? {} : { retiredAt: retired ? (course.retiredAt ?? new Date()) : null }),
      },
    });
    const action = retired === true ? "course.retire" : retired === false ? "course.restore" : "course.edit";
    await recordAdminAction(adminId, action, { type: "course", id }, { ...input }, tx);
    return updated;
  });
  invalidateCourseList(); // edit, retire or restore: pickers must change straight away on this server
  return result;
}
