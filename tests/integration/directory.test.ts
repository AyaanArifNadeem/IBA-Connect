import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/members/route");

const viewerId = "0f0f0f0f-0000-4000-8000-000000000001";
const get = (query = "") => GET(new Request(`http://localhost/api/v1/members${query}`), {});
const data = async (query = "") => (await (await get(query)).json()).data;

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: viewerId, email: "viewer@khi.iba.edu.pk", name: "Viewer" });
  auth.getUser.mockResolvedValue({
    data: { user: { id: viewerId, email: "viewer@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
});
afterAll(() => testDb.$disconnect());

describe("GET /api/v1/members (FR2.1, US2.1)", () => {
  it("TC-044: lists members page by page in name order", async () => {
    for (let i = 0; i < 20; i++) await makeUser({ name: `Member ${String(i).padStart(2, "0")}` });
    const first = await data();
    expect(first).toMatchObject({ page: 1, total: 20, pages: 2 });
    expect(first.members).toHaveLength(18);
    expect(first.members[0].name).toBe("Member 00");
    const second = await data("?page=2");
    expect(second.members.map((m: { name: string }) => m.name)).toEqual(["Member 18", "Member 19"]);
  });

  it("TC-045: never includes an email or other contact details", async () => {
    await makeUser({ email: "secret.person@khi.iba.edu.pk", personalEmail: "secret@example.test" });
    const raw = await (await get()).text();
    expect(raw).not.toContain("secret");
    expect(raw).not.toContain("@");
  });

  it("shows only active members with a finished profile, and not the viewer", async () => {
    await makeUser({ name: "Visible" });
    await makeUser({ name: "Unfinished", profileCompletedAt: null });
    await makeUser({ name: "Suspended", status: UserStatus.SUSPENDED });
    await makeUser({ name: "Deactivated", status: UserStatus.DEACTIVATED });
    await makeUser({ name: "Deleted", deletedAt: new Date() });
    const names = (await data()).members.map((m: { name: string }) => m.name);
    expect(names).toEqual(["Visible"]);
  });

  it("shows advise courses only when the member is available, and alumni field and company", async () => {
    const course = await testDb.course.create({ data: { code: "CSE341", title: "DB", department: "Computer Science" } });
    await makeUser({ name: "Adviser", availableToAdvise: true, courses: { create: [{ courseId: course.id, canAdvise: true }] } });
    await makeUser({ name: "Former adviser", availableToAdvise: false, courses: { create: [{ courseId: course.id, canAdvise: true }] } });
    await makeUser({ name: "Alumna", role: Role.ALUMNUS, field: "Banking & Finance", company: "Contoso Bank" });
    const members = (await data()).members;
    const by = (n: string) => members.find((m: { name: string }) => m.name === n);
    expect(by("Adviser").adviseCourses).toEqual(["CSE341"]);
    expect(by("Former adviser").adviseCourses).toEqual([]);
    expect(by("Alumna")).toMatchObject({ isAlumnus: true, field: "Banking & Finance", company: "Contoso Bank" });
  });

  it("TC-029: refuses signed-out visitors", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await get()).status).toBe(401);
  });

  it("rejects an invalid page number", async () => {
    expect((await get("?page=0")).status).toBe(400);
  });
});
