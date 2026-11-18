import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VerificationMethod } from "@/lib/generated/prisma/enums";
import { listMembers } from "@/lib/services/directory";
import { resetDatabase, testDb } from "./helpers";

// TC-050 / NFR1: 95th percentile under 2 s on a seeded dataset of 1,000 members (NFR2).
const MEMBERS = 1000;
const FIRST = ["Ali", "Sara", "Hamza", "Ayesha", "Bilal", "Fatima", "Usman", "Zainab", "Omar", "Hira"];
const LAST = ["Khan", "Raza", "Siddiqui", "Qureshi", "Malik", "Ahmed", "Hussain", "Baig", "Mirza", "Shah"];
const SKILLS = ["Python", "SQL", "React", "Excel", "Statistics", "Research", "Figma", "Java", "Marketing", "Writing"];
const QUERIES = ["python", "khan", "sql react", "cse3", "database", "ali", "marketing", "stat", "zzz", "machine learning"];

let viewerId: string;

beforeAll(async () => {
  await resetDatabase();
  const skills = await Promise.all(SKILLS.map((name) => testDb.skill.create({ data: { name, slug: name.toLowerCase() } })));
  const courses = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      testDb.course.create({ data: { code: `CSE${300 + i}`, title: i % 2 ? `Database Topics ${i}` : `Machine Learning ${i}`, department: "Computer Science" } }),
    ),
  );
  const users = Array.from({ length: MEMBERS }, (_, i) => ({
    id: randomUUID(),
    email: `perf${i}@member.test`,
    name: `${FIRST[i % 10]} ${LAST[Math.floor(i / 10) % 10]} ${i}`,
    verificationMethod: VerificationMethod.EMAIL,
    batch: 2020 + (i % 6),
    programme: "BS Computer Science",
    department: "Computer Science",
    semester: 1 + (i % 8),
    bio: "Performance test member",
    profileCompletedAt: new Date(),
  }));
  await testDb.user.createMany({ data: users });
  await testDb.userSkill.createMany({
    data: users.flatMap((u, i) => [skills[i % 10], skills[(i * 3) % 10]].map((s) => ({ userId: u.id, skillId: s.id }))),
    skipDuplicates: true,
  });
  await testDb.userCourse.createMany({
    data: users.flatMap((u, i) => [courses[i % 30], courses[(i * 7) % 30], courses[(i * 11) % 30]].map((c) => ({ userId: u.id, courseId: c.id }))),
    skipDuplicates: true,
  });
  await testDb.$executeRawUnsafe("ANALYZE");
  viewerId = users[0].id;
}, 120_000);
afterAll(() => testDb.$disconnect());

describe("search performance (NFR1, TC-050)", () => {
  it("answers 100 searches with a 95th percentile under 2 seconds", async () => {
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await listMembers(viewerId, { page: 1 + (i % 3), q: QUERIES[i % QUERIES.length] });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[94];
    console.info(`[NFR1] 100 searches on ${MEMBERS} members: median ${times[49].toFixed(0)} ms, p95 ${p95.toFixed(0)} ms`);
    expect(p95).toBeLessThan(2000);
  }, 120_000);
});
