/**
 * Department and programme lists used by profiles, filters and Need Board tags.
 * Team-maintained (there is no official IBA data feed); courses live in the database (FR1.10).
 */
export const DEPARTMENTS = [
  "Accounting & Finance",
  "Computer Science",
  "Economics",
  "Finance",
  "Management",
  "Marketing",
  "Mathematics",
  "Social Sciences & Liberal Arts",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const PROGRAMMES = [
  "BBA",
  "BS Accounting & Finance",
  "BS Computer Science",
  "BS Economics",
  "BS Economics & Mathematics",
  "BS Mathematics",
  "BS Social Sciences & Liberal Arts",
  "MBA",
  "MS Computer Science",
  "MS Economics",
] as const;

export type Programme = (typeof PROGRAMMES)[number];

/** Batch = year of intake. Alumni can go back further than current students. */
export const MIN_BATCH = 1960;
export const maxBatch = () => new Date().getFullYear();

export const MIN_SEMESTER = 1;
export const MAX_SEMESTER = 12;

/** Career fields for alumni profiles and the alumni filter (US1.7, US2.5). */
export const ALUMNI_FIELDS = [
  "Accounting & Audit",
  "Banking & Finance",
  "Consulting",
  "Data & Analytics",
  "Education & Research",
  "Entrepreneurship",
  "Government & Policy",
  "Marketing & Sales",
  "Media & Communications",
  "Software & IT",
  "Supply Chain & Operations",
  "Other",
] as const;

export type AlumniField = (typeof ALUMNI_FIELDS)[number];
