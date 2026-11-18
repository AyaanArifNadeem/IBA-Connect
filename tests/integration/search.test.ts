import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { searchTerms } from "@/lib/services/directory";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/members/route");

const viewerId = "2b2b2b2b-0000-4000-8000-000000000001";
const names = async (q: string) => {
  const res = await GET(new Request(`http://localhost/api/v1/members?q=${encodeURIComponent(q)}`), {});
  return (await res.json()).data.members.map((m: { name: string }) => m.name).sort();
};

beforeAll(async () => {
  await resetDatabase();
  auth.getUser.mockResolvedValue({
    data: { user: { id: viewerId, email: "v@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  await makeUser({ id: viewerId, name: "Viewer Python" });
  const [py, sql] = await Promise.all([
    testDb.skill.create({ data: { name: "Python", slug: "python" } }),
    testDb.skill.create({ data: { name: "SQL", slug: "sql" } }),
  ]);
  const [db, ml] = await Promise.all([
    testDb.course.create({ data: { code: "CSE341", title: "Database Systems", department: "Computer Science" } }),
    testDb.course.create({ data: { code: "CSE442", title: "Machine Learning", department: "Computer Science" } }),
  ]);
  await makeUser({ name: "Ali Khan", skills: { create: [{ skillId: py.id }] }, courses: { create: [{ courseId: db.id }] } });
  await makeUser({ name: "Sara Raza", skills: { create: [{ skillId: sql.id }] }, courses: { create: [{ courseId: ml.id }] } });
  await makeUser({ name: "Hamza Pythonovich" });
});
afterAll(() => testDb.$disconnect());

describe("free-text search (FR2.2, US2.2)", () => {
  it("TC-047: finds members by skill, and by name containing the word", async () => {
    expect(await names("Python")).toEqual(["Ali Khan", "Hamza Pythonovich"]);
  });

  it("TC-048: finds members by course code, with or without a space, and by course title", async () => {
    expect(await names("CSE341")).toEqual(["Ali Khan"]);
    expect(await names("cse 341")).toEqual(["Ali Khan"]); // "cse" and "341" both match his course code
    expect(await names("database")).toEqual(["Ali Khan"]);
  });

  it("matches partial words and ignores letter case", async () => {
    expect(await names("sa")).toEqual(["Sara Raza"]);
    expect(await names("MACHINE")).toEqual(["Sara Raza"]);
  });

  it("requires every word to match", async () => {
    expect(await names("python database")).toEqual(["Ali Khan"]);
    expect(await names("python machine")).toEqual([]);
  });

  it("TC-049: returns nothing for a word nobody has", async () => {
    expect(await names("zzqxv")).toEqual([]);
  });

  it("never matches the viewer", async () => {
    expect(await names("viewer")).toEqual([]);
  });

  it("rejects an overly long search", async () => {
    const res = await GET(new Request(`http://localhost/api/v1/members?q=${"a".repeat(101)}`), {});
    expect(res.status).toBe(400);
  });
});

describe("searchTerms", () => {
  it("splits on spaces and commas, drops one-letter words and duplicates", () => {
    expect(searchTerms("  Python, SQL  python a ")).toEqual(["python", "sql"]);
    expect(searchTerms(undefined)).toEqual([]);
  });
});
