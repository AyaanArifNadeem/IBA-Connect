import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PostStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { POST } = await import("@/app/api/v1/posts/route");

const meId = "aaaa0000-0000-4000-8000-000000000001";
const publish = (body: unknown) => POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }), {});
const valid = { type: "STUDY_PARTNER", title: "CSE341 study buddy", body: "Looking for someone to revise with before the mids." };

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId });
  await testDb.course.create({ data: { code: "CSE341", title: "Database Systems", department: "Computer Science" } });
  await testDb.course.create({ data: { code: "OLD100", title: "Old", department: "Economics", retiredAt: new Date() } });
  auth.getUser.mockResolvedValue({ data: { user: { id: meId, email: "me@x.test", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
});
afterAll(() => testDb.$disconnect());

describe("POST /api/v1/posts (FR4.1, US4.1)", () => {
  it("TC-075: publishes an open post with a course tag that expires in 14 days", async () => {
    const before = Date.now();
    const res = await publish({ ...valid, course: "cse341" });
    expect(res.status).toBe(201);
    const post = await testDb.post.findFirstOrThrow({ include: { course: true } });
    expect(post).toMatchObject({ authorId: meId, type: "STUDY_PARTNER", status: PostStatus.OPEN, title: "CSE341 study buddy" });
    expect(post.course?.code).toBe("CSE341");
    const days = (post.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(13.99);
    expect(days).toBeLessThan(14.01);
  });

  it("accepts a department tag, or no tag at all", async () => {
    expect((await publish({ ...valid, department: "Economics" })).status).toBe(201);
    expect((await publish({ ...valid, type: "CAREER_ADVICE" })).status).toBe(201);
    expect(await testDb.post.count()).toBe(2);
  });

  it("TC-076: refuses a post without a title or details", async () => {
    const res = await publish({ type: "STUDY_PARTNER", title: "", body: "" });
    expect(res.status).toBe(400);
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["title", "body"]));
    expect(await testDb.post.count()).toBe(0);
  });

  it("refuses an unknown type, both tags at once, and an unknown or retired course", async () => {
    expect((await publish({ ...valid, type: "DATING" })).status).toBe(400);
    const both = await publish({ ...valid, course: "CSE341", department: "Economics" });
    expect((await both.json()).error.details[0].message).toBe("Tag a course or a department, not both");
    expect((await publish({ ...valid, course: "XYZ999" })).status).toBe(400);
    expect((await publish({ ...valid, course: "OLD100" })).status).toBe(400);
  });

  it("limits each member to 10 posts a day", async () => {
    for (let i = 0; i < 10; i++) expect((await publish(valid)).status).toBe(201);
    expect((await publish(valid)).status).toBe(429);
  });

  it("requires a signed-in member with a finished profile", async () => {
    await testDb.user.update({ where: { id: meId }, data: { profileCompletedAt: null } });
    expect((await publish(valid)).status).toBe(403);
  });
});
