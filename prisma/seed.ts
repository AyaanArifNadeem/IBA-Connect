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

const DAY = 86_400_000;
const NOTES = [
  "Hi! I'm taking this course next semester, could you share some tips?",
  "Looking for a study partner for the mids, are you interested?",
  "Saw your profile, would love to chat about your field.",
  "Need a teammate for a project, your skills look like a great fit.",
];
const CHAT = [
  "Hey, thanks for connecting!",
  "Sure, happy to help. What do you need?",
  "Mainly the past papers and how to prepare for the quizzes.",
  "I'll share my notes tomorrow. Focus on normalisation first.",
  "Perfect, thank you so much!",
];
const POSTS: { type: "STUDY_PARTNER" | "PROJECT_TEAMMATE" | "COURSE_ADVICE" | "CAREER_ADVICE"; title: string; body: string; course?: string; department?: string }[] = [
  { type: "STUDY_PARTNER", title: "CSE341 study partner before mids", body: "Revising normalisation and SQL joins three evenings a week in the library.", course: "CSE341" },
  { type: "PROJECT_TEAMMATE", title: "Frontend developer for SE project", body: "Building a campus app in React for Software Engineering. Need one more person.", course: "CSE343" },
  { type: "COURSE_ADVICE", title: "Is Econometrics manageable with a full load?", body: "Thinking of taking ECO301 next semester with four other courses.", course: "ECO301" },
  { type: "CAREER_ADVICE", title: "Advice on banking internships", body: "Second-year BBA student, looking for tips on summer internships in banking.", department: "Finance" },
  { type: "STUDY_PARTNER", title: "Linear Algebra problem sets group", body: "Weekly problem-solving sessions on Saturdays.", course: "MTS211" },
  { type: "COURSE_ADVICE", title: "Which ML electives are worth it?", body: "Choosing between Machine Learning and AI next semester.", course: "CSE442" },
  { type: "PROJECT_TEAMMATE", title: "Marketing research teammate", body: "Need a partner for the consumer behaviour field study.", course: "MKT301" },
  { type: "CAREER_ADVICE", title: "Software jobs after graduation", body: "What should I focus on in my last year to get a developer role?", department: "Computer Science" },
];

/**
 * Demo activity between seeded members so every screen has data (connections, messages,
 * pending requests, Need Board posts with responses). Fixed ids, so re-running is harmless.
 */
async function seedActivity(memberCount: number) {
  const members = await db.user.findMany({
    where: { email: { endsWith: "@demo.iba-connect.test" } },
    orderBy: { email: "asc" },
    take: Math.min(memberCount, 30),
    select: { id: true },
  });
  if (members.length < 12) return { connections: 0, posts: 0 };
  const now = Date.now();
  let connections = 0;

  // Accepted connections with a short chat
  for (let i = 0; i + 1 < 12; i += 2) {
    const [a, b] = [members[i].id, members[i + 1].id];
    const id = stableUuid(`connection:${a}:${b}`);
    await db.connection.upsert({
      where: { id },
      update: {},
      create: { id, requesterId: a, recipientId: b, contextNote: NOTES[i % NOTES.length], status: "ACCEPTED", createdAt: new Date(now - 6 * DAY), respondedAt: new Date(now - 5 * DAY) },
    });
    for (let m = 0; m < CHAT.length; m++) {
      const mid = stableUuid(`message:${id}:${m}`);
      await db.message.upsert({
        where: { id: mid },
        update: {},
        create: { id: mid, connectionId: id, senderId: m % 2 ? b : a, body: CHAT[m], sentAt: new Date(now - 5 * DAY + m * 3_600_000), readAt: new Date(now - 4 * DAY) },
      });
    }
    connections++;
  }
  // Pending and declined requests
  for (let i = 12; i + 1 < Math.min(members.length, 20); i += 2) {
    const id = stableUuid(`connection:${members[i].id}:${members[i + 1].id}`);
    const declined = i % 4 === 0;
    await db.connection.upsert({
      where: { id },
      update: {},
      create: {
        id,
        requesterId: members[i].id,
        recipientId: members[i + 1].id,
        contextNote: NOTES[i % NOTES.length],
        status: declined ? "DECLINED" : "PENDING",
        createdAt: new Date(now - 2 * DAY),
        respondedAt: declined ? new Date(now - DAY) : null,
      },
    });
    connections++;
  }

  // Need Board posts: open ones of different ages, one closed, one expired
  let posts = 0;
  for (let p = 0; p < POSTS.length; p++) {
    const spec = POSTS[p];
    const author = members[(p * 3) % members.length].id;
    const id = stableUuid(`post:${p}`);
    const course = spec.course ? await db.course.findUnique({ where: { code: spec.course }, select: { id: true } }) : null;
    const createdAt = new Date(now - (p + 1) * DAY);
    const status = p === 6 ? "CLOSED" : "OPEN";
    const expiresAt = p === 7 ? new Date(now - DAY) : new Date(createdAt.getTime() + 14 * DAY);
    await db.post.upsert({
      where: { id },
      update: {},
      create: { id, authorId: author, type: spec.type, title: spec.title, body: spec.body, courseId: course?.id ?? null, departmentTag: spec.department ?? null, status, closedAt: status === "CLOSED" ? new Date(now - DAY) : null, createdAt, expiresAt },
    });
    posts++;
    // A response from another member, which is a pending connection request carrying the post
    if (p < 4) {
      const responder = members[(p * 3 + 13) % members.length].id;
      if (responder === author) continue;
      const cid = stableUuid(`response-connection:${id}`);
      const exists = await db.connection.findFirst({
        where: { status: { in: ["PENDING", "ACCEPTED"] }, OR: [{ requesterId: responder, recipientId: author }, { requesterId: author, recipientId: responder }] },
      });
      if (exists && exists.id !== cid) continue;
      await db.connection.upsert({
        where: { id: cid },
        update: {},
        create: { id: cid, requesterId: responder, recipientId: author, contextNote: "I can help with this!", originPostId: id, createdAt: new Date(now - p * DAY) },
      });
      await db.postResponse.upsert({
        where: { postId_responderId: { postId: id, responderId: responder } },
        update: {},
        create: { postId: id, responderId: responder, message: "I can help with this!", connectionId: cid },
      });
    }
  }
  return { connections, posts };
}

async function main() {
  const memberCount = Number(process.env.SEED_MEMBER_COUNT ?? 60);
  const courses = await seedCourses();
  const skills = await seedSkills();
  await seedMembers(memberCount, courses, skills);
  const activity = await seedActivity(memberCount);
  const admins = await promoteAdmins();
  console.log(
    `Seeded ${courses.length} courses, ${skills.length} skills, ${memberCount} demo members, ${activity.connections} connections and ${activity.posts} posts; promoted ${admins} admin(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
