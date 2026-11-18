import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/members/route");

const viewerId = "3c3c3c3c-0000-4000-8000-000000000001";
const get = (qs: string) => GET(new Request(`http://localhost/api/v1/members?${qs}`), {});
const names = async (qs: string) => (await (await get(qs)).json()).data.members.map((m: { name: string }) => m.name).sort();

beforeAll(async () => {
  await resetDatabase();
  auth.getUser.mockResolvedValue({
    data: { user: { id: viewerId, email: "v@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  await makeUser({ id: viewerId, name: "Viewer" });
  const [py, sql] = await Promise.all([
    testDb.skill.create({ data: { name: "Python", slug: "python" } }),
    testDb.skill.create({ data: { name: "SQL", slug: "sql" } }),
  ]);
  const [cse341, eco101] = await Promise.all([
    testDb.course.create({ data: { code: "CSE341", title: "Database Systems", department: "Computer Science" } }),
    testDb.course.create({ data: { code: "ECO101", title: "Microeconomics", department: "Economics" } }),
  ]);
  // Advises on CSE341
  await makeUser({ name: "Ali Adviser", batch: 2022, availableToAdvise: true, skills: { create: [{ skillId: py.id }] }, courses: { create: [{ courseId: cse341.id, canAdvise: true }] } });
  // Took CSE341 but advises only on ECO101
  await makeUser({ name: "Sara Other", batch: 2023, availableToAdvise: true, skills: { create: [{ skillId: sql.id }] }, courses: { create: [{ courseId: cse341.id }, { courseId: eco101.id, canAdvise: true }] } });
  // Took CSE341, not advising
  await makeUser({ name: "Hamza Student", batch: 2023, department: "Economics", programme: "BS Economics", courses: { create: [{ courseId: cse341.id }] } });
  await makeUser({ name: "Ayesha Alumna", role: Role.ALUMNUS, batch: 2015, field: "Banking & Finance", company: "Contoso Bank" });
  await makeUser({ name: "Omar Alumnus", role: Role.ALUMNUS, batch: 2012, field: "Consulting", company: "Fabrikam Consulting" });
});
afterAll(() => testDb.$disconnect());

describe("directory filters (FR2.3)", () => {
  it("filters by course", async () => {
    expect(await names("course=cse341")).toEqual(["Ali Adviser", "Hamza Student", "Sara Other"]);
  });

  it("TC-051: course plus available to advise finds advisers for that course only (US2.4)", async () => {
    expect(await names("course=CSE341&advise=1")).toEqual(["Ali Adviser"]);
  });

  it("available to advise on its own finds every adviser", async () => {
    expect(await names("advise=1")).toEqual(["Ali Adviser", "Sara Other"]);
  });

  it("filters by skill, ignoring letter case", async () => {
    expect(await names("skill=python")).toEqual(["Ali Adviser"]);
  });

  it("TC-052: combined filters must all match, and no filters shows everyone (US2.3)", async () => {
    expect(await names("batch=2023&department=Economics")).toEqual(["Hamza Student"]);
    expect(await names("batch=2023&programme=BS%20Computer%20Science")).toEqual(["Sara Other"]);
    expect(await names("")).toHaveLength(5);
  });

  it("combines filters with free-text search", async () => {
    expect(await names("q=sara&course=CSE341")).toEqual(["Sara Other"]);
  });

  it("TC-053: alumni only, then by field and company (US2.5)", async () => {
    expect(await names("alumni=1")).toEqual(["Ayesha Alumna", "Omar Alumnus"]);
    expect(await names("field=Banking%20%26%20Finance")).toEqual(["Ayesha Alumna"]);
    expect(await names("company=fabrikam")).toEqual(["Omar Alumnus"]);
  });

  it("TC-089: rejects invalid filter values", async () => {
    const res = await get("batch=abc&department=Astrology");
    expect(res.status).toBe(400);
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["batch", "department"]));
  });

  it("ignores empty filter values from the form", async () => {
    expect(await names("course=&batch=&department=")).toHaveLength(5);
  });
});
