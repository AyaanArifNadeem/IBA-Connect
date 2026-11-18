/** Need Board constants shared by server and client (FR4.1). */
export const POST_TYPES = ["STUDY_PARTNER", "PROJECT_TEAMMATE", "COURSE_ADVICE", "CAREER_ADVICE"] as const;
export type PostTypeValue = (typeof POST_TYPES)[number];

export const POST_TYPE_LABELS: Record<PostTypeValue, string> = {
  STUDY_PARTNER: "Study partner",
  PROJECT_TEAMMATE: "Project teammate",
  COURSE_ADVICE: "Course advice",
  CAREER_ADVICE: "Career advice",
};

/** URL-friendly names for the type filter (?type=study-partner). */
export const POST_TYPE_SLUGS: Record<PostTypeValue, string> = {
  STUDY_PARTNER: "study-partner",
  PROJECT_TEAMMATE: "project-teammate",
  COURSE_ADVICE: "course-advice",
  CAREER_ADVICE: "career-advice",
};

export const POST_LIFETIME_DAYS = 14;
export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

/** Whole days left before a post expires (at least 0). */
export function daysLeft(expiresAt: Date | string, now = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
