import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus, PostStatus } from "@/lib/generated/prisma/enums";
import { getMyPost, listOpenPosts, boardQuerySchema } from "@/lib/services/posts";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const closeRoute = await import("@/app/api/v1/posts/[id]/close/route");
const mineRoute = await import("@/app/api/v1/posts/mine/route");

const meId = "dddd0000-0000-4000-8000-000000000001";
const DAY = 86_400_000;
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const close = (id: string) => closeRoute.POST(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id }) });
const post = (data: Record<string, unknown> = {}) =>
  testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "CSE341 study buddy", body: "x", expiresAt: new Date(Date.now() + 14 * DAY), ...data } });
async function withResponse(postId: string) {
  const responder = await makeUser({ name: "Ali Khan" });
  const connection = await testDb.connection.create({ data: { requesterId: responder.id, recipientId: meId, contextNote: "I can help", originPostId: postId } });
  await testDb.postResponse.create({ data: { postId, responderId: responder.id, message: "I can help", connectionId: connection.id } });
  return { responder, connection };
}
const onBoard = async () => (await listOpenPosts("00000000-0000-4000-8000-0000000000ff", boardQuerySchema.parse({}))).posts.map((p) => p.id);

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId });
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("close and expire posts (FR4.4)", () => {
  it("TC-081: closing removes the post from the board; responses stay visible to me (US4.4)", async () => {
    const p = await post();
    await withResponse(p.id);
    expect(await onBoard()).toEqual([p.id]);

    const res = await close(p.id);
    expect(res.status).toBe(200);
    expect(await testDb.post.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: PostStatus.CLOSED, closedAt: expect.any(Date) });
    expect(await onBoard()).toEqual([]);

    const mine = await getMyPost(meId, p.id);
    expect(mine.state).toBe("closed");
    expect(mine.responses).toEqual([expect.objectContaining({ message: "I can help", responder: expect.objectContaining({ name: "Ali Khan" }), connectionStatus: ConnectionStatus.PENDING })]);
  });

  it("TC-082: a post 14 days old has expired; responses stay visible to me (US4.5)", async () => {
    const p = await post({ createdAt: new Date(Date.now() - 14 * DAY - 1000), expiresAt: new Date(Date.now() - 1000) });
    await withResponse(p.id);
    expect(await onBoard()).toEqual([]);
    const mine = await getMyPost(meId, p.id);
    expect(mine.state).toBe("expired");
    expect(mine.responses).toHaveLength(1);
  });

  it("TC-093: only the author can close a post", async () => {
    const p = await post();
    const other = await makeUser();
    signInAs(other.id);
    expect((await close(p.id)).status).toBe(403);
    expect((await testDb.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(PostStatus.OPEN);
  });

  it("refuses closing twice, closing an expired post, or an unknown post", async () => {
    const p = await post();
    await close(p.id);
    expect((await close(p.id)).status).toBe(409);
    const expired = await post({ expiresAt: new Date(Date.now() - 1000) });
    expect((await close(expired.id)).status).toBe(409);
    expect((await close("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("lists my posts with their state, and hides other members' posts from getMyPost", async () => {
    const open = await post({ title: "Open one" });
    await post({ title: "Closed one", status: PostStatus.CLOSED, createdAt: new Date(Date.now() - DAY) });
    await post({ title: "Expired one", expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 20 * DAY) });
    const list = (await (await mineRoute.GET(new Request("http://localhost/x"), {})).json()).data;
    expect(list.map((p: { title: string; state: string }) => [p.title, p.state])).toEqual([
      ["Open one", "open"],
      ["Closed one", "closed"],
      ["Expired one", "expired"],
    ]);

    const other = await makeUser();
    await expect(getMyPost(other.id, open.id)).rejects.toMatchObject({ status: 404 });
  });

  it("shows accepted responses as connected", async () => {
    const p = await post();
    const { connection } = await withResponse(p.id);
    await testDb.connection.update({ where: { id: connection.id }, data: { status: ConnectionStatus.ACCEPTED } });
    expect((await getMyPost(meId, p.id)).responses[0].connectionStatus).toBe(ConnectionStatus.ACCEPTED);
  });
});
