import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { listCourses } from "@/lib/services/profile";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const listRoute = await import("@/app/api/v1/admin/courses/route");
const itemRoute = await import("@/app/api/v1/admin/courses/[id]/route");

const adminId = "ad000000-0000-4000-8000-0000000000aa";
const studentId = "57000000-0000-4000-8000-0000000000bb";
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: "x@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const add = (body: unknown) => listRoute.POST(req("POST", body), {});
const patch = (id: string, body: unknown) => itemRoute.PATCH(req("PATCH", body), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: adminId, email: "admin@khi.iba.edu.pk", role: Role.ADMIN });
  await makeUser({ id: studentId, email: "student@khi.iba.edu.pk" });
  signInAs(adminId);
});
afterAll(() => testDb.$disconnect());

describe("admin: course list (FR1.10)", () => {
  it("TC-041: adds a course that then appears in the pickers", async () => {
    const res = await add({ code: "cse 450", title: "Cloud Computing", department: "Computer Science" });
    expect(res.status).toBe(201);
    expect((await res.json()).data.code).toBe("CSE450");
    expect((await listCourses()).map((c) => c.code)).toContain("CSE450");
    expect(await testDb.adminAction.count({ where: { action: "course.add" } })).toBe(1);
  });

  it("TC-043: rejects a duplicate course code", async () => {
    await add({ code: "CSE341", title: "Database Systems", department: "Computer Science" });
    const res = await add({ code: "cse341", title: "Copy", department: "Computer Science" });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toBe("Course code already exists.");
  });

  it("TC-042: a retired course leaves the pickers but stays on existing profiles", async () => {
    const course = (await (await add({ code: "CSE450", title: "Cloud Computing", department: "Computer Science" })).json()).data;
    await testDb.userCourse.create({ data: { userId: studentId, courseId: course.id } });

    expect((await patch(course.id, { retired: true })).status).toBe(200);
    expect((await listCourses()).map((c) => c.code)).not.toContain("CSE450");
    expect(await testDb.userCourse.count({ where: { courseId: course.id } })).toBe(1);

    const all = (await (await listRoute.GET(req("GET"), {})).json()).data;
    expect(all).toEqual([expect.objectContaining({ code: "CSE450", retired: true, members: 1 })]);

    await patch(course.id, { retired: false });
    expect((await listCourses()).map((c) => c.code)).toContain("CSE450");
  });

  it("edits a course title and department", async () => {
    const course = (await (await add({ code: "MKT201", title: "Marketing", department: "Marketing" })).json()).data;
    const res = await patch(course.id, { title: "Principles of Marketing" });
    expect((await res.json()).data.title).toBe("Principles of Marketing");
    expect(await testDb.adminAction.count({ where: { action: "course.edit" } })).toBe(1);
  });

  it("validates the code format and department", async () => {
    const res = await add({ code: "Database 1", title: "X course", department: "Astrology" });
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["code", "department"]));
  });

  it("refuses non-admins", async () => {
    signInAs(studentId);
    expect((await add({ code: "CSE450", title: "Cloud", department: "Computer Science" })).status).toBe(403);
  });
});
