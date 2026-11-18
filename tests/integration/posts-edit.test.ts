import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PostStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { PATCH } = await import("@/app/api/v1/posts/[id]/route");

const meId = "eeee0000-0000-4000-8000-000000000001";
const DAY = 86_400_000;
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const edit = (id: string, body: unknown) =>
  PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const post = (data: Record<string, unknown> = {}) =>
  testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "Old title", body: "Old body", expiresAt: new Date(Date.now() + 14 * DAY), ...data } });
const changes = { title: "CSE341 study buddy (evenings)", body: "Evenings work best", course: "CSE341" };

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId });
  await testDb.course.create({ data: { code: "CSE341", title: "DB", department: "Computer Science" } });
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("PATCH /api/v1/posts/{id} (FR4.5)", () => {
  it("TC-083: the author edits title, details and tag of an open post", async () => {
    const p = await post();
    expect((await edit(p.id, changes)).status).toBe(200);
    const saved = await testDb.post.findUniqueOrThrow({ where: { id: p.id }, include: { course: true } });
    expect(saved).toMatchObject({ title: changes.title, body: changes.body, type: "STUDY_PARTNER", status: PostStatus.OPEN });
    expect(saved.course?.code).toBe("CSE341");
  });

  it("can swap the course tag for a department tag", async () => {
    const p = await post();
    await edit(p.id, changes);
    await edit(p.id, { ...changes, course: null, department: "Economics" });
    expect(await testDb.post.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ courseId: null, departmentTag: "Economics" });
  });

  it("TC-084: refuses another member's post, and closed or expired posts", async () => {
    const p = await post();
    const other = await makeUser();
    signInAs(other.id);
    expect((await edit(p.id, changes)).status).toBe(403);
    signInAs(meId);
    const closed = await post({ status: PostStatus.CLOSED });
    const expired = await post({ expiresAt: new Date(Date.now() - 1000) });
    expect((await edit(closed.id, changes)).status).toBe(409);
    expect((await edit(expired.id, changes)).status).toBe(409);
    expect((await testDb.post.findUniqueOrThrow({ where: { id: p.id } })).title).toBe("Old title");
  });

  it("does not allow changing the type", async () => {
    const p = await post();
    expect((await edit(p.id, { ...changes, type: "CAREER_ADVICE" })).status).toBe(400);
  });

  it("validates like a new post", async () => {
    const p = await post();
    expect((await edit(p.id, { ...changes, title: "" })).status).toBe(400);
    expect((await edit(p.id, { ...changes, course: "XYZ999" })).status).toBe(400);
    expect((await edit(p.id, { ...changes, department: "Economics" })).status).toBe(400);
  });
});
