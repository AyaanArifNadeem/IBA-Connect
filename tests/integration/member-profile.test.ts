import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus, Role, UserStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/members/[id]/route");

const viewerId = "1a1a1a1a-0000-4000-8000-000000000001";
const get = (id: string) => GET(new Request(`http://localhost/api/v1/members/${id}`), { params: Promise.resolve({ id }) });
const profileOf = async (id: string) => (await (await get(id)).json()).data;

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: viewerId, email: "viewer@khi.iba.edu.pk" });
  auth.getUser.mockResolvedValue({
    data: { user: { id: viewerId, email: "viewer@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
});
afterAll(() => testDb.$disconnect());

describe("GET /api/v1/members/{id} (US2.6)", () => {
  it("TC-046: shows the profile details, skills, courses and advise courses", async () => {
    const course = await testDb.course.create({ data: { code: "CSE341", title: "Database Systems", department: "Computer Science" } });
    const skill = await testDb.skill.create({ data: { name: "SQL", slug: "sql" } });
    const ali = await makeUser({
      name: "Ali Khan",
      bio: "Ask me about databases",
      availableToAdvise: true,
      courses: { create: [{ courseId: course.id, canAdvise: true }] },
      skills: { create: [{ skillId: skill.id }] },
    });
    expect(await profileOf(ali.id)).toMatchObject({
      name: "Ali Khan",
      batch: 2024,
      programme: "BS Computer Science",
      department: "Computer Science",
      semester: 5,
      bio: "Ask me about databases",
      skills: ["SQL"],
      courses: [{ code: "CSE341", title: "Database Systems", canAdvise: true }],
      availableToAdvise: true,
      isSelf: false,
    });
  });

  it("TC-045 / TC-066: hides the email when the members are not connected, even with a pending request", async () => {
    const ali = await makeUser({ email: "ali.private@khi.iba.edu.pk" });
    await testDb.connection.create({ data: { requesterId: viewerId, recipientId: ali.id, contextNote: "hi" } });
    const res = await get(ali.id);
    const raw = await res.text();
    expect(JSON.parse(raw).data.email).toBeNull();
    expect(raw).not.toContain("ali.private");
  });

  it("TC-067: shows the email once the connection is accepted, in either direction", async () => {
    const ali = await makeUser({ email: "ali@khi.iba.edu.pk" });
    await testDb.connection.create({
      data: { requesterId: ali.id, recipientId: viewerId, contextNote: "hi", status: ConnectionStatus.ACCEPTED },
    });
    expect((await profileOf(ali.id)).email).toBe("ali@khi.iba.edu.pk");
  });

  it("shows your own profile with your email", async () => {
    const own = await profileOf(viewerId);
    expect(own).toMatchObject({ isSelf: true, email: "viewer@khi.iba.edu.pk" });
  });

  it("does not show suspended, unfinished or unknown profiles", async () => {
    const suspended = await makeUser({ status: UserStatus.SUSPENDED });
    const unfinished = await makeUser({ profileCompletedAt: null });
    expect((await get(suspended.id)).status).toBe(404);
    expect((await get(unfinished.id)).status).toBe(404);
    expect((await get("not-a-uuid")).status).toBe(404);
  });

  it("shows field and company for alumni and no semester", async () => {
    const alumna = await makeUser({ role: Role.ALUMNUS, field: "Consulting", company: "Fabrikam", semester: 8 });
    expect(await profileOf(alumna.id)).toMatchObject({ isAlumnus: true, field: "Consulting", company: "Fabrikam", semester: null });
  });

  it("does not mark courses as advised when advising is off", async () => {
    const course = await testDb.course.create({ data: { code: "ECO101", title: "Micro", department: "Economics" } });
    const ali = await makeUser({ availableToAdvise: false, courses: { create: [{ courseId: course.id, canAdvise: true }] } });
    expect((await profileOf(ali.id)).courses[0].canAdvise).toBe(false);
  });
});
