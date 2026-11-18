import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PostStatus, UserStatus } from "@/lib/generated/prisma/enums";
import type { PostTypeValue } from "@/lib/board";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/posts/route");

const meId = "bbbb0000-0000-4000-8000-000000000001";
const DAY = 86_400_000;
const titles = async (qs = "") => {
  const res = await GET(new Request(`http://localhost/x?${qs}`), {});
  return (await res.json()).data.posts.map((p: { title: string }) => p.title);
};
let authorId: string;
let cse341: string;
const post = (title: string, data: Partial<{ type: PostTypeValue; courseId: string; departmentTag: string; status: PostStatus; expiresAt: Date; createdAt: Date; authorId: string; body: string }> = {}) =>
  testDb.post.create({
    data: { authorId, type: "STUDY_PARTNER", title, body: "details", expiresAt: new Date(Date.now() + 14 * DAY), ...data },
  });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId });
  authorId = (await makeUser({ name: "Sara Raza" })).id;
  cse341 = (await testDb.course.create({ data: { code: "CSE341", title: "DB", department: "Computer Science" } })).id;
  auth.getUser.mockResolvedValue({ data: { user: { id: meId, email: "me@x.test", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
});
afterAll(() => testDb.$disconnect());

describe("GET /api/v1/posts (FR4.2, US4.2)", () => {
  it("TC-077: shows only open posts, newest first", async () => {
    await post("Older open", { createdAt: new Date(Date.now() - 2 * DAY) });
    await post("Newest open");
    await post("Closed", { status: PostStatus.CLOSED });
    await post("Expired", { expiresAt: new Date(Date.now() - 1000) });
    expect(await titles()).toEqual(["Newest open", "Older open"]);
  });

  it("TC-077: filters by type and by course or department tag", async () => {
    await post("CSE341 advice", { type: "COURSE_ADVICE", courseId: cse341 });
    await post("Econ partner", { departmentTag: "Economics" });
    await post("Career chat", { type: "CAREER_ADVICE" });
    expect(await titles("type=course-advice")).toEqual(["CSE341 advice"]);
    expect(await titles("course=cse341")).toEqual(["CSE341 advice"]);
    expect(await titles("department=Economics")).toEqual(["Econ partner"]);
    expect(await titles("type=course-advice&course=CSE341")).toEqual(["CSE341 advice"]);
    expect(await titles("type=career-advice&course=CSE341")).toEqual([]);
  });

  it("TC-092: closed and expired posts never appear, even when filtered by their tag", async () => {
    await post("Open one", { courseId: cse341 });
    await post("Closed one", { courseId: cse341, status: PostStatus.CLOSED });
    await post("Expired one", { courseId: cse341, expiresAt: new Date(Date.now() - DAY) });
    expect(await titles("course=CSE341")).toEqual(["Open one"]);
  });

  it("searches titles and details", async () => {
    await post("Study partner wanted", { body: "for statistics revision" });
    await post("Project teammate", { body: "react app" });
    expect(await titles("q=statistics")).toEqual(["Study partner wanted"]);
    expect(await titles("q=REACT")).toEqual(["Project teammate"]);
  });

  it("hides posts from suspended or deleted members and marks my own posts", async () => {
    const suspended = await makeUser({ status: UserStatus.SUSPENDED });
    await post("From suspended", { authorId: suspended.id });
    await post("Mine", { authorId: meId });
    const res = await GET(new Request("http://localhost/x"), {});
    const posts = (await res.json()).data.posts;
    expect(posts.map((p: { title: string; mine: boolean }) => [p.title, p.mine])).toEqual([["Mine", true]]);
  });

  it("rejects an unknown type or department", async () => {
    expect((await GET(new Request("http://localhost/x?type=dating"), {})).status).toBe(400);
    expect((await GET(new Request("http://localhost/x?department=Astrology"), {})).status).toBe(400);
  });
});
