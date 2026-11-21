/**
 * Ready-to-use demo logins for testing and the sprint demo (run after the seed):
 *
 *   DEMO_ACCOUNT_PASSWORD=... npm run db:demo
 *
 * Creates (or refreshes) five Supabase Auth users that are already email-confirmed, and gives
 * four of them a finished profile with connections, messages, requests and posts:
 *   admin    admin@khi.iba.edu.pk     admin (only if listed in SEED_ADMIN_EMAILS, FR8.5)
 *   adviser  adviser@khi.iba.edu.pk   student, available to advise on CSE341 and CSE342
 *   student  student@khi.iba.edu.pk   student
 *   alumnus  alumnus@khi.iba.edu.pk   alumnus with field and company
 *   newbie   newbie@khi.iba.edu.pk    signed up, no profile yet (to test profile setup)
 * The password is never stored in the repository.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, VerificationMethod } from "../lib/generated/prisma/client";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const password = process.env.DEMO_ACCOUNT_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!password || !url || !serviceKey || !connectionString) {
  throw new Error("Set DEMO_ACCOUNT_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const admins = (process.env.SEED_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
const DAY = 86_400_000;

const stableUuid = (key: string) => {
  const h = createHash("sha256").update(`iba-connect-demo:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

type Account = {
  key: string;
  email: string;
  name: string;
  role: Role;
  method: VerificationMethod;
  profile?: { batch: number; programme: string; department: string; semester: number | null; bio: string; skills: string[]; courses: string[]; advise?: string[]; field?: string; company?: string };
};

const ACCOUNTS: Account[] = [
  {
    key: "admin", email: "admin@khi.iba.edu.pk", name: "Hina Admin", role: Role.ADMIN, method: VerificationMethod.EMAIL,
    profile: { batch: 2021, programme: "BS Computer Science", department: "Computer Science", semester: 8, bio: "IBA Connect team. Here to keep the community safe.", skills: ["Project Management", "SQL"], courses: ["CSE343"] },
  },
  {
    key: "adviser", email: "adviser@khi.iba.edu.pk", name: "Sara Adviser", role: Role.STUDENT, method: VerificationMethod.EMAIL,
    profile: { batch: 2022, programme: "BS Computer Science", department: "Computer Science", semester: 7, bio: "Senior CS student. Happy to help juniors with databases and operating systems.", skills: ["SQL", "Python", "Java"], courses: ["CSE341", "CSE342", "CSE241"], advise: ["CSE341", "CSE342"] },
  },
  {
    key: "student", email: "student@khi.iba.edu.pk", name: "Ali Student", role: Role.STUDENT, method: VerificationMethod.EMAIL,
    profile: { batch: 2024, programme: "BS Computer Science", department: "Computer Science", semester: 3, bio: "Second-year CS student, looking for study partners and project teammates.", skills: ["JavaScript", "React"], courses: ["CSE141", "CSE142", "MTS101"] },
  },
  {
    key: "alumnus", email: "alumnus@khi.iba.edu.pk", name: "Bilal Alumnus", role: Role.ALUMNUS, method: VerificationMethod.ALUMNI_CODE,
    profile: { batch: 2015, programme: "BBA", department: "Finance", semester: null, bio: "BBA 2015, now in corporate banking. Ask me about careers in finance.", skills: ["Financial Modelling", "Excel"], courses: ["FIN201", "ACC101"], field: "Banking & Finance", company: "Contoso Bank" },
  },
  { key: "newbie", email: "newbie@khi.iba.edu.pk", name: "Nida Newbie", role: Role.STUDENT, method: VerificationMethod.EMAIL },
];

async function findAuthUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

/** Create the confirmed auth user, or reset its password; returns the auth user id. */
async function ensureAuthUser(a: Account): Promise<string> {
  const existing = await findAuthUser(a.email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { name: a.name } });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({ id: stableUuid(a.email), email: a.email, password, email_confirm: true, user_metadata: { name: a.name } });
  if (error) throw error;
  return data.user.id;
}

async function ensureMember(id: string, a: Account) {
  const p = a.profile!;
  const role = a.role === Role.ADMIN && !admins.includes(a.email) ? Role.STUDENT : a.role;
  const courses = await db.course.findMany({ where: { code: { in: p.courses } }, select: { id: true, code: true } });
  const skills = await Promise.all(
    p.skills.map((name) => db.skill.upsert({ where: { slug: name.toLowerCase() }, update: {}, create: { name, slug: name.toLowerCase() } })),
  );
  const data = {
    email: a.email, name: a.name, role, verificationMethod: a.method, status: "ACTIVE" as const, deletedAt: null,
    batch: p.batch, programme: p.programme, department: p.department, semester: p.semester, bio: p.bio,
    availableToAdvise: Boolean(p.advise?.length), field: p.field ?? null, company: p.company ?? null, profileCompletedAt: new Date(),
  };
  await db.user.upsert({ where: { id }, update: data, create: { id, ...data } });
  await db.userSkill.deleteMany({ where: { userId: id } });
  await db.userCourse.deleteMany({ where: { userId: id } });
  await db.userSkill.createMany({ data: skills.map((s) => ({ userId: id, skillId: s.id })) });
  await db.userCourse.createMany({ data: courses.map((c) => ({ userId: id, courseId: c.id, canAdvise: Boolean(p.advise?.includes(c.code)) })) });
}

async function connect(id: string, requesterId: string, recipientId: string, note: string, status: "PENDING" | "ACCEPTED", daysAgo: number, originPostId?: string) {
  await db.connection.upsert({
    where: { id },
    update: {},
    create: { id, requesterId, recipientId, contextNote: note, status, originPostId, createdAt: new Date(Date.now() - daysAgo * DAY), respondedAt: status === "ACCEPTED" ? new Date(Date.now() - (daysAgo - 1) * DAY) : null },
  });
}

async function activity(ids: Record<string, string>) {
  const seeded = await db.user.findMany({ where: { email: { endsWith: "@demo.iba-connect.test" } }, orderBy: { email: "asc" }, take: 6, select: { id: true } });
  const cse341 = await db.course.findUnique({ where: { code: "CSE341" } });

  // Student <-> adviser: connected, with a chat; the last message is unread for the student
  const chat = stableUuid("chat:student-adviser");
  await connect(chat, ids.student, ids.adviser, "Hi Sara, I'm taking CSE341 next semester. Could you share some advice?", "ACCEPTED", 4);
  const lines: [string, string, boolean][] = [
    [ids.student, "Hi Sara, thanks for accepting!", true],
    [ids.adviser, "Of course! What would you like to know about CSE341?", true],
    [ids.student, "How should I prepare for the first quiz?", true],
    [ids.adviser, "Practise ER diagrams and normalisation. I'll send you my notes.", false],
  ];
  // Running the script again resets the chat: extra messages go and the read state is restored
  const messageIds = lines.map((_, i) => stableUuid(`chat:student-adviser:${i}`));
  await db.message.deleteMany({ where: { connectionId: chat, id: { notIn: messageIds } } });
  for (let i = 0; i < lines.length; i++) {
    const [sender, body, read] = lines[i];
    const mid = messageIds[i];
    const readAt = read ? new Date() : null;
    await db.message.upsert({ where: { id: mid }, update: { readAt }, create: { id: mid, connectionId: chat, senderId: sender, body, sentAt: new Date(Date.now() - (3 - i * 0.5) * DAY), readAt } });
  }

  // Pending requests waiting for the student and the alumnus; one sent by the student
  if (seeded.length >= 4) {
    await connect(stableUuid("req:seed0-student"), seeded[0].id, ids.student, "Hey Ali, want to form a study group for MTS101?", "PENDING", 1);
    await connect(stableUuid("req:seed1-alumnus"), seeded[1].id, ids.alumnus, "Hi Bilal, I'd love some advice on banking careers.", "PENDING", 1);
    await connect(stableUuid("req:student-seed2"), ids.student, seeded[2].id, "Hi! Your React skills look great, interested in a project?", "PENDING", 2);
    await connect(stableUuid("req:adviser-alumnus"), ids.alumnus, ids.adviser, "Hi Sara, happy to talk about careers after CS.", "ACCEPTED", 6);
  }

  // Need Board posts by the demo accounts, one with a response
  const studentPost = stableUuid("post:student");
  await db.post.upsert({
    where: { id: studentPost },
    update: {},
    create: { id: studentPost, authorId: ids.student, type: "STUDY_PARTNER", title: "CSE341 study buddy for next semester", body: "Looking for someone to prepare with before the semester starts.", courseId: cse341?.id ?? null, createdAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() + 13 * DAY) },
  });
  const adviserPost = stableUuid("post:adviser");
  await db.post.upsert({
    where: { id: adviserPost },
    update: {},
    create: { id: adviserPost, authorId: ids.adviser, type: "COURSE_ADVICE", title: "Ask me anything about Operating Systems", body: "Taking questions about CSE342 projects and exams this week.", createdAt: new Date(Date.now() - 2 * DAY), expiresAt: new Date(Date.now() + 12 * DAY) },
  });
  if (seeded.length >= 4) {
    const responseConnection = stableUuid("resp:seed3-student");
    await connect(responseConnection, seeded[3].id, ids.student, "I'm also taking CSE341, let's prepare together!", "PENDING", 0.5, studentPost);
    await db.postResponse.upsert({
      where: { postId_responderId: { postId: studentPost, responderId: seeded[3].id } },
      update: {},
      create: { postId: studentPost, responderId: seeded[3].id, message: "I'm also taking CSE341, let's prepare together!", connectionId: responseConnection },
    });
  }
}

async function main() {
  const ids: Record<string, string> = {};
  for (const a of ACCOUNTS) {
    const id = await ensureAuthUser(a);
    ids[a.key] = id;
    if (a.profile) await ensureMember(id, a);
    else await db.user.deleteMany({ where: { id } }); // newbie: always starts without a profile
  }
  await activity(ids);
  console.log("Demo accounts ready:");
  for (const a of ACCOUNTS) console.log(`  ${a.key.padEnd(8)} ${a.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
