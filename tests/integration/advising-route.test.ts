import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { PUT } = await import("@/app/api/v1/profile/advising/route");

const memberId = "a5a5a5a5-1111-4222-8333-444455556666";
let cse341: string;
let eco101: string;
let notMine: string;
const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/v1/profile/advising", { method: "PUT", body: JSON.stringify(body) }), {});

beforeEach(async () => {
  await resetDatabase();
  auth.getUser.mockResolvedValue({
    data: { user: { id: memberId, email: "s@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  const mk = (code: string) => testDb.course.create({ data: { code, title: code, department: "Computer Science" } });
  [cse341, eco101, notMine] = (await Promise.all([mk("CSE341"), mk("ECO101"), mk("MTS211")])).map((c) => c.id);
  await makeUser({ id: memberId, email: "s@khi.iba.edu.pk", courses: { create: [{ courseId: cse341 }, { courseId: eco101 }] } });
});
afterAll(() => testDb.$disconnect());

const flags = async () =>
  Object.fromEntries((await testDb.userCourse.findMany({ where: { userId: memberId } })).map((c) => [c.courseId, c.canAdvise]));

describe("PUT /api/v1/profile/advising (FR1.5, US1.8)", () => {
  it("TC-026: turns advising on for the chosen courses", async () => {
    const res = await put({ available: true, courseIds: [cse341] });
    expect(res.status).toBe(200);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).availableToAdvise).toBe(true);
    expect(await flags()).toEqual({ [cse341]: true, [eco101]: false });
  });

  it("TC-027: turning it off clears the badge and every course flag", async () => {
    await put({ available: true, courseIds: [cse341, eco101] });
    const res = await put({ available: false });
    expect(res.status).toBe(200);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).availableToAdvise).toBe(false);
    expect(await flags()).toEqual({ [cse341]: false, [eco101]: false });
  });

  it("TC-087: refuses to turn it on without a course", async () => {
    const res = await put({ available: true, courseIds: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].message).toBe("Choose at least one course you can advise on");
  });

  it("refuses courses that are not in the member's profile", async () => {
    const res = await put({ available: true, courseIds: [notMine] });
    expect(res.status).toBe(400);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).availableToAdvise).toBe(false);
  });

  it("changing the chosen courses replaces the old choice", async () => {
    await put({ available: true, courseIds: [cse341] });
    await put({ available: true, courseIds: [eco101] });
    expect(await flags()).toEqual({ [cse341]: false, [eco101]: true });
  });
});
