import { z } from "zod";
import { ALUMNI_FIELDS, DEPARTMENTS, MAX_SEMESTER, MIN_BATCH, MIN_SEMESTER, PROGRAMMES, maxBatch } from "@/lib/constants/academics";

export const MAX_SKILLS = 15;
export const MAX_COURSES = 40;
export const BIO_MAX = 500;

const skillName = z
  .string()
  .trim()
  .min(1)
  .max(40, "Each skill can be at most 40 characters")
  .transform((s) => s.replace(/\s+/g, " "));

/**
 * Profile form (FR1.4, US1.5). Required: name, batch, programme, department, semester
 * (current students), bio and at least one skill. Courses are optional.
 */
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  batch: z.coerce
    .number({ error: "Enter your batch (year of intake)" })
    .int()
    .min(MIN_BATCH, `Batch must be ${MIN_BATCH} or later`)
    .refine((b) => b <= maxBatch(), "Batch cannot be in the future"),
  programme: z.enum(PROGRAMMES, { error: "Choose your programme" }),
  department: z.enum(DEPARTMENTS, { error: "Choose your department" }),
  /** Required for current students; ignored for alumni */
  semester: z.coerce
    .number()
    .int()
    .min(MIN_SEMESTER, "Choose your current semester")
    .max(MAX_SEMESTER, `Semester must be ${MAX_SEMESTER} or less`)
    .nullable()
    .optional(),
  bio: z
    .string()
    .trim()
    .min(1, "Write a short bio")
    .max(BIO_MAX, `Bio can be at most ${BIO_MAX} characters`),
  skills: z
    .array(skillName)
    .min(1, "Add at least one skill")
    .max(MAX_SKILLS, `Add at most ${MAX_SKILLS} skills`)
    .transform((list) => {
      // Drop duplicates that differ only in letter case
      const seen = new Set<string>();
      return list.filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)));
    }),
  /** Alumni only (US1.7) */
  field: z.enum(ALUMNI_FIELDS, { error: "Choose your field" }).nullable().optional(),
  company: z.string().trim().max(80, "Company name is too long").nullable().optional(),
  courseIds: z.array(z.uuid()).max(MAX_COURSES, `Add at most ${MAX_COURSES} courses`).default([]),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const skillSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
