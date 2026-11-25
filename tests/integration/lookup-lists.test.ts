import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { addCourse, updateCourse } from "@/lib/services/admin-courses";
import { invalidateCourseList, invalidateSkillList, listCourses, suggestSkills, saveProfile } from "@/lib/services/profile";
import { makeUser, resetDatabase, testDb } from "./helpers";

// These tests need the cache on (the integration setup turns it off for everything else)
beforeEach(async () => {
  vi.stubEnv("LOOKUP_CACHE_TTL_MS", "60000");
  await resetDatabase();
  invalidateCourseList();
  invalidateSkillList();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await testDb.$disconnect();
});

const course = (code: string, extra = {}) => ({ code, title: `${code} title`, department: "Computer Science", ...extra });

describe("cached course and skill lists (Issue 7)", () => {
  it("serves the unfiltered course list from memory until something changes it", async () => {
    await testDb.course.create({ data: course("CSE101") });
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE101"]);

    await testDb.course.create({ data: course("CSE102") }); // written behind the cache's back
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE101"]);

    invalidateCourseList();
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE101", "CSE102"]);
  });

  it("never serves a search from the cache", async () => {
    await testDb.course.create({ data: course("CSE101") });
    await listCourses();
    await testDb.course.create({ data: course("ECO201", { department: "Economics" }) });
    expect((await listCourses("eco")).map((c) => c.code)).toEqual(["ECO201"]);
    expect((await suggestSkills("py")).length).toBe(0);
  });

  it("an admin adding, editing or retiring a course shows up at once", async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    expect(await listCourses()).toEqual([]);

    const added = await addCourse(admin.id, { code: "CSE 301", title: "Databases", department: "Computer Science" });
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE301"]);

    await updateCourse(admin.id, added.id, { title: "Database Systems" });
    expect((await listCourses())[0].title).toBe("Database Systems");

    await updateCourse(admin.id, added.id, { retired: true });
    expect(await listCourses()).toEqual([]);
    await updateCourse(admin.id, added.id, { retired: false });
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE301"]);
  });

  it("a failed admin change leaves the cache alone", async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    await testDb.course.create({ data: course("CSE101") });
    await listCourses();
    await testDb.course.create({ data: course("CSE102") });
    await expect(addCourse(admin.id, { code: "CSE101", title: "Dup", department: "Computer Science" })).rejects.toMatchObject({ status: 409 });
    expect((await listCourses()).map((c) => c.code)).toEqual(["CSE101"]); // still the cached list
  });

  it("a skill added through a profile save is suggested straight away", async () => {
    const member = await makeUser({ profileCompletedAt: null });
    expect(await suggestSkills()).toEqual([]);
    await saveProfile({ id: member.id, role: member.role, profileCompletedAt: null }, {
      name: "Sara Raza",
      batch: 2024,
      programme: "BS Computer Science",
      department: "Computer Science",
      semester: 5,
      bio: "Hi",
      skills: ["Rust"],
      courseIds: [],
      field: null,
      company: null,
    });
    expect((await suggestSkills()).map((s) => s.name)).toEqual(["Rust"]);
  });
});
