import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Signed-in identity comes from a fake Supabase client; everything else is real.
const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

const { GET, PUT } = await import("@/app/api/v1/profile/route");
const { GET: getCourses } = await import("@/app/api/v1/courses/route");

const memberId = "8a1f7c2e-5b3d-4e6f-9a0b-1c2d3e4f5a6b";
const signIn = (id = memberId) =>
  auth.getUser.mockResolvedValue({
    data: { user: { id, email: "m@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/v1/profile", { method: "PUT", body: JSON.stringify(body) }), {});

let cse341: string;
let retired: string;
const valid = () => ({
  name: "Sara Raza",
  batch: 2023,
  programme: "BS Computer Science",
  department: "Computer Science",
  semester: 5,
  bio: "Happy to help with databases.",
  skills: ["Python", "SQL"],
  courseIds: [cse341],
});

beforeEach(async () => {
  await resetDatabase();
  auth.getUser.mockReset();
  cse341 = (await testDb.course.create({ data: { code: "CSE341", title: "Database Systems", department: "Computer Science" } })).id;
  retired = (await testDb.course.create({ data: { code: "OLD100", title: "Old", department: "Computer Science", retiredAt: new Date() } })).id;
  await makeUser({ id: memberId, email: "m@khi.iba.edu.pk", profileCompletedAt: null, bio: null, batch: null });
  signIn();
});
afterAll(() => testDb.$disconnect());

describe("PUT /api/v1/profile (FR1.4, US1.5)", () => {
  it("TC-019: saves a complete profile and finishes setup", async () => {
    const res = await put(valid());
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body).toMatchObject({ name: "Sara Raza", batch: 2023, semester: 5, profileCompleted: true, skills: ["Python", "SQL"] });
    expect(body.courses).toEqual([{ id: cse341, code: "CSE341", title: "Database Systems", canAdvise: false }]);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).profileCompletedAt).not.toBeNull();
  });

  it("TC-020: refuses to finish without a skill", async () => {
    const res = await put({ ...valid(), skills: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{ path: "skills", message: "Add at least one skill" }]);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).profileCompletedAt).toBeNull();
  });

  it("TC-021: rejects a bio longer than 500 characters", async () => {
    const res = await put({ ...valid(), bio: "a".repeat(501) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].path).toBe("bio");
  });

  it("requires the semester for a current student", async () => {
    const res = await put({ ...valid(), semester: null });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].path).toBe("semester");
  });

  it("TC-025: saves field and company for an alumnus, who needs no semester (US1.7)", async () => {
    await testDb.user.update({ where: { id: memberId }, data: { role: Role.ALUMNUS } });
    const res = await put({ ...valid(), semester: null, field: "Banking & Finance", company: "Contoso Bank" });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ semester: null, field: "Banking & Finance", company: "Contoso Bank" });
  });

  it("requires field and company from alumni", async () => {
    await testDb.user.update({ where: { id: memberId }, data: { role: Role.ALUMNUS } });
    const res = await put({ ...valid(), semester: null });
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(["field", "company"]);
  });

  it("ignores field and company sent for a current student", async () => {
    const res = await put({ ...valid(), field: "Consulting", company: "Fabrikam" });
    expect((await res.json()).data).toMatchObject({ field: null, company: null });
  });

  it("rejects a field that is not on the list", async () => {
    await testDb.user.update({ where: { id: memberId }, data: { role: Role.ALUMNUS } });
    const res = await put({ ...valid(), semester: null, field: "Astrology", company: "X" });
    expect((await res.json()).error.details[0].path).toBe("field");
  });

  it("reuses skills from the shared list and drops case-only duplicates", async () => {
    await testDb.skill.create({ data: { name: "Python", slug: "python" } });
    const res = await put({ ...valid(), skills: ["python", "PYTHON", "Data  Analysis"] });
    expect((await res.json()).data.skills).toEqual(["Data Analysis", "Python"]);
    expect(await testDb.skill.count()).toBe(2);
  });

  it("refuses a retired or unknown course", async () => {
    const res = await put({ ...valid(), courseIds: [retired] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].path).toBe("courseIds");
  });

  it("rejects an invalid programme or a future batch", async () => {
    const res = await put({ ...valid(), programme: "BS Astrology", batch: new Date().getFullYear() + 1 });
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["programme", "batch"]));
  });

  it("keeps the advise flag on courses the member keeps (US1.8)", async () => {
    await put(valid());
    await testDb.userCourse.update({ where: { userId_courseId: { userId: memberId, courseId: cse341 } }, data: { canAdvise: true } });
    const res = await put({ ...valid(), bio: "Updated bio" });
    expect((await res.json()).data.courses[0].canAdvise).toBe(true);
  });

  it("requires a signed-in member", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await put(valid())).status).toBe(401);
  });
});

describe("GET /api/v1/profile and /api/v1/courses", () => {
  it("returns the member's own profile, including their email", async () => {
    const res = await GET(new Request("http://localhost/api/v1/profile"), {});
    const body = (await res.json()).data;
    expect(body.email).toBe("m@khi.iba.edu.pk");
    expect(body.profileCompleted).toBe(false);
  });

  it("lists active courses only, filtered by code or title", async () => {
    const all = (await (await getCourses(new Request("http://localhost/api/v1/courses"), {})).json()).data;
    expect(all.map((c: { code: string }) => c.code)).toEqual(["CSE341"]);
    const byTitle = (await (await getCourses(new Request("http://localhost/api/v1/courses?q=datab"), {})).json()).data;
    expect(byTitle).toHaveLength(1);
  });
});
