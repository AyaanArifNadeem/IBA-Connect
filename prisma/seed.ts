/**
 * Demo data for IBA Connect (SRS 6.6). Safe to run more than once.
 *
 * - Course list, skill list.
 * - SEED_MEMBER_COUNT fictional members (default 60; use 1000 for the NFR2 search test).
 *   Every seeded email uses the reserved ".test" domain, so it can never belong to a real
 *   person, and seeded members cannot sign in (they have no Supabase Auth account).
 * - Admin role (FR8.5): members whose email is in SEED_ADMIN_EMAILS (comma-separated)
 *   are promoted to ADMIN. This is the only way to become an admin.
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, VerificationMethod } from "../lib/generated/prisma/client";
import { ALUMNI_FIELDS as FIELDS, DEPARTMENTS, PROGRAMMES } from "../lib/constants/academics";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ------------------------------------------------------------------ helpers

/** Deterministic pseudo-random numbers so every run produces the same data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const pickSome = <T>(items: readonly T[], min: number, max: number): T[] => {
  const count = min + Math.floor(rand() * (max - min + 1));
  return [...items].sort(() => rand() - 0.5).slice(0, count);
};

/** Stable UUID derived from a string, so re-seeding updates rather than duplicates. */
function stableUuid(key: string): string {
  const h = createHash("sha256").update(`iba-connect-seed:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const slugify = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// --------------------------------------------------------------------- data

const COURSES: { code: string; title: string; department: (typeof DEPARTMENTS)[number] }[] = [
  { code: "CSE141", title: "Introduction to Programming", department: "Computer Science" },
  { code: "CSE142", title: "Object Oriented Programming", department: "Computer Science" },
  { code: "CSE241", title: "Data Structures", department: "Computer Science" },
  { code: "CSE245", title: "Discrete Mathematics", department: "Computer Science" },
  { code: "CSE341", title: "Database Systems", department: "Computer Science" },
  { code: "CSE342", title: "Operating Systems", department: "Computer Science" },
  { code: "CSE343", title: "Software Engineering", department: "Computer Science" },
  { code: "CSE344", title: "Computer Networks", department: "Computer Science" },
  { code: "CSE441", title: "Artificial Intelligence", department: "Computer Science" },
  { code: "CSE442", title: "Machine Learning", department: "Computer Science" },
  { code: "MTS101", title: "Calculus I", department: "Mathematics" },
  { code: "MTS102", title: "Calculus II", department: "Mathematics" },
  { code: "MTS211", title: "Linear Algebra", department: "Mathematics" },
  { code: "MTS231", title: "Probability and Statistics", department: "Mathematics" },
  { code: "ECO101", title: "Principles of Microeconomics", department: "Economics" },
  { code: "ECO102", title: "Principles of Macroeconomics", department: "Economics" },
  { code: "ECO301", title: "Econometrics", department: "Economics" },
  { code: "ACC101", title: "Financial Accounting", department: "Accounting & Finance" },
  { code: "ACC201", title: "Managerial Accounting", department: "Accounting & Finance" },
  { code: "FIN201", title: "Corporate Finance", department: "Finance" },
  { code: "FIN301", title: "Investment Analysis", department: "Finance" },
  { code: "MGT101", title: "Principles of Management", department: "Management" },
  { code: "MGT301", title: "Organisational Behaviour", department: "Management" },
  { code: "MKT201", title: "Principles of Marketing", department: "Marketing" },
  { code: "MKT301", title: "Consumer Behaviour", department: "Marketing" },
  { code: "SSL101", title: "Introduction to Sociology", department: "Social Sciences & Liberal Arts" },
  { code: "SSL201", title: "Pakistan Studies", department: "Social Sciences & Liberal Arts" },
  { code: "ENG101", title: "Academic Writing", department: "Social Sciences & Liberal Arts" },
];

const SKILLS = [
  "Python", "Java", "C++", "JavaScript", "TypeScript", "React", "SQL", "Data Analysis",
  "Machine Learning", "Excel", "Financial Modelling", "Public Speaking", "Research",
  "UI/UX Design", "Figma", "Marketing Strategy", "Accounting", "Statistics", "R",
  "Writing", "Project Management", "Git", "Power BI", "Econometrics", "Tableau",
];

const FIRST_NAMES = [
  "Ali", "Sara", "Hamza", "Ayesha", "Bilal", "Fatima", "Usman", "Zainab", "Hassan", "Maryam",
  "Omar", "Hira", "Danish", "Mahnoor", "Saad", "Iqra", "Fahad", "Areeba", "Taha", "Noor",
  "Rayan", "Anaya", "Shayan", "Laiba", "Zaid", "Eman", "Faizan", "Alina", "Hasan", "Rida",
];
const LAST_NAMES = [
  "Khan", "Raza", "Siddiqui", "Qureshi", "Sheikh", "Malik", "Ahmed", "Hussain", "Baig", "Mirza",
  "Farooqui", "Hashmi", "Abbasi", "Chaudhry", "Jafri", "Rizvi", "Ansari", "Memon", "Shah", "Zaidi",
];
const ALUMNI_FIELDS = FIELDS.filter((f) => f !== "Other");
const COMPANIES = ["Northwind Labs", "Contoso Bank", "Fabrikam Consulting", "Tailspin Analytics", "Adatum Group", "Litware Ltd", "Proseware Inc", "Own startup"];
const BIOS = [
  "Happy to help juniors with course planning and study groups.",
  "Looking for teammates for project-based courses.",
  "Enjoy explaining tricky concepts; ask me about my courses.",
  "Interested in research and data. Always up for a coffee chat.",
  "Building side projects and learning something new every semester.",
];

// --------------------------------------------------------------------- seed

async function seedCourses() {
  for (const c of COURSES) {
    await db.course.upsert({
      where: { code: c.code },
      update: { title: c.title, department: c.department },
      create: c,
    });
  }
  return db.course.findMany({ where: { retiredAt: null } });
}

async function seedSkills() {
  for (const name of SKILLS) {
    await db.skill.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
  }
  return db.skill.findMany();
}

async function seedMembers(count: number, courses: { id: string }[], skills: { id: string }[]) {
  const thisYear = new Date().getFullYear();
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `${first}.${last}.${i + 1}@demo.iba-connect.test`.toLowerCase();
    const id = stableUuid(email);
    const isAlumnus = rand() < 0.25;
    const batch = isAlumnus ? thisYear - 5 - Math.floor(rand() * 10) : thisYear - Math.floor(rand() * 4);
    const advising = !isAlumnus && batch <= thisYear - 2 && rand() < 0.5;
    const taken = pickSome(courses, 2, 6);

    await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email,
        name,
        role: isAlumnus ? Role.ALUMNUS : Role.STUDENT,
        verificationMethod: isAlumnus ? VerificationMethod.ALUMNI_LIST : VerificationMethod.MICROSOFT,
        batch,
        programme: pick(PROGRAMMES),
        department: pick(DEPARTMENTS),
        semester: isAlumnus ? null : Math.min(8, (thisYear - batch) * 2 + 1),
        bio: pick(BIOS),
        availableToAdvise: advising,
        field: isAlumnus ? pick(ALUMNI_FIELDS) : null,
        company: isAlumnus ? pick(COMPANIES) : null,
        profileCompletedAt: new Date(),
        courses: {
          create: taken.map((c, n) => ({ courseId: c.id, canAdvise: advising && n < 2 })),
        },
        skills: { create: pickSome(skills, 1, 4).map((s) => ({ skillId: s.id })) },
      },
    });
  }
}

async function promoteAdmins() {
  const emails = (process.env.SEED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return 0;
  const result = await db.user.updateMany({ where: { email: { in: emails } }, data: { role: Role.ADMIN } });
  return result.count;
}

async function main() {
  const memberCount = Number(process.env.SEED_MEMBER_COUNT ?? 60);
  const courses = await seedCourses();
  const skills = await seedSkills();
  await seedMembers(memberCount, courses, skills);
  const admins = await promoteAdmins();
  console.log(
    `Seeded ${courses.length} courses, ${skills.length} skills, ${memberCount} demo members; promoted ${admins} admin(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
