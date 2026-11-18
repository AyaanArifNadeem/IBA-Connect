import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus, PostStatus, UserStatus, VerificationMethod } from "@/lib/generated/prisma/enums";
import { directoryQuerySchema, listMembers } from "@/lib/services/directory";
import { listConversations } from "@/lib/services/messages";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() };
const admin = { deleteUser: vi.fn() };
const storage = { remove: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
  createAdminClient: () => ({ auth: { admin }, storage: { from: () => storage } }),
}));
const deactivateRoute = await import("@/app/api/v1/account/deactivate/route");
const accountRoute = await import("@/app/api/v1/account/route");
const signInRoute = await import("@/app/api/v1/auth/sign-in/route");

const meId = "abcd0000-0000-4000-8000-000000000001";
const viewerId = "abcd0000-0000-4000-8000-000000000002";
const signedInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const directoryNames = async () => (await listMembers(viewerId, directoryQuerySchema.parse({}))).members.map((m) => m.name);
const remove = (confirm: string) =>
  accountRoute.DELETE(new Request("http://localhost/x", { method: "DELETE", body: JSON.stringify({ confirm }) }), {});
let ip = 0;
const signIn = () =>
  signInRoute.POST(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "x-forwarded-for": `198.18.0.${++ip}` },
      body: JSON.stringify({ email: "sara@khi.iba.edu.pk", password: "Str0ng!Pass" }),
    }),
    {},
  );

beforeEach(async () => {
  await resetDatabase();
  Object.values({ ...auth, ...admin, ...storage }).forEach((f) => f.mockReset());
  admin.deleteUser.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  await makeUser({ id: meId, name: "Sara Raza", email: "sara@khi.iba.edu.pk", avatarPath: `${meId}/a.png`, bio: "About me" });
  await makeUser({ id: viewerId, name: "Viewer" });
  signedInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("deactivate (FR1.8)", () => {
  it("TC-034: the profile leaves the directory; signing in again brings it back", async () => {
    expect(await directoryNames()).toEqual(["Sara Raza"]);
    expect((await deactivateRoute.POST(new Request("http://localhost/x", { method: "POST" }), {})).status).toBe(200);
    expect(await directoryNames()).toEqual([]);

    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: meId, email: "sara@khi.iba.edu.pk", user_metadata: {} } }, error: null });
    expect((await signIn()).status).toBe(200);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: meId } })).status).toBe(UserStatus.ACTIVE);
    expect(await directoryNames()).toEqual(["Sara Raza"]);
  });
});

describe("delete (FR1.8, SRS 6.5)", () => {
  it("TC-035: anonymises the profile, keeps messages as Deleted member, and removes the sign-in account", async () => {
    const course = await testDb.course.create({ data: { code: "CSE341", title: "DB", department: "Computer Science" } });
    await testDb.userCourse.create({ data: { userId: meId, courseId: course.id } });
    const chat = await testDb.connection.create({ data: { requesterId: meId, recipientId: viewerId, contextNote: "hi", status: ConnectionStatus.ACCEPTED } });
    await testDb.message.create({ data: { connectionId: chat.id, senderId: meId, body: "See you" } });
    const pending = await makeUser();
    await testDb.connection.create({ data: { requesterId: pending.id, recipientId: meId, contextNote: "x" } });
    await testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "Open", body: "x", expiresAt: new Date(Date.now() + 86_400_000) } });

    expect((await remove("DELETE")).status).toBe(200);

    const me = await testDb.user.findUniqueOrThrow({ where: { id: meId }, include: { courses: true } });
    expect(me).toMatchObject({ name: "Deleted member", bio: null, avatarPath: null, personalEmail: null, status: UserStatus.DEACTIVATED, courses: [] });
    expect(me.email).toBe(`deleted-${meId}@deleted.invalid`);
    expect(me.deletedAt).not.toBeNull();
    expect(admin.deleteUser).toHaveBeenCalledWith(meId);
    expect(storage.remove).toHaveBeenCalledWith([`${meId}/a.png`]);

    expect(await directoryNames()).not.toContain("Sara Raza");
    expect((await testDb.message.findFirstOrThrow()).body).toBe("See you");
    expect((await listConversations(viewerId))[0].name).toBe("Deleted member");
    expect(await testDb.connection.count({ where: { status: ConnectionStatus.PENDING } })).toBe(0);
    expect(await testDb.post.count({ where: { status: PostStatus.OPEN } })).toBe(0);
  });

  it("TC-036: nothing changes without the typed confirmation", async () => {
    expect((await remove("delete")).status).toBe(400);
    expect((await remove("")).status).toBe(400);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: meId } })).deletedAt).toBeNull();
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("a deleted account cannot sign in, even if removing the sign-in account had failed", async () => {
    admin.deleteUser.mockResolvedValue({ error: { message: "network" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await remove("DELETE");
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: meId, email: "x", user_metadata: {} } }, error: null });
    expect((await signIn()).status).toBe(401);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("keeps alumni verification records for audit", async () => {
    await testDb.user.update({ where: { id: meId }, data: { verificationMethod: VerificationMethod.ALUMNI_CODE } });
    await testDb.alumniRecord.create({ data: { kind: "CODE", inviteCode: "IBA-AAAA-BBBB", claimedById: meId, claimedAt: new Date() } });
    await remove("DELETE");
    expect((await testDb.alumniRecord.findFirstOrThrow()).claimedById).toBe(meId);
  });
});
