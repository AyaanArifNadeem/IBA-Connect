import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { listConversations, unreadTotal } from "@/lib/services/messages";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/connections/[id]/messages/route");

const meId = "7a7a7a7a-0000-4000-8000-000000000001";
const open = (id: string) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });
const say = (connectionId: string, senderId: string, body: string) => testDb.message.create({ data: { connectionId, senderId, body } });
const connect = (a: string, b: string, status: ConnectionStatus = ConnectionStatus.ACCEPTED) =>
  testDb.connection.create({ data: { requesterId: a, recipientId: b, contextNote: "Hi", status } });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId });
  auth.getUser.mockResolvedValue({ data: { user: { id: meId, email: "me@x.test", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
});
afterAll(() => testDb.$disconnect());

describe("unread indicators (US3.6, FR3.6)", () => {
  it("TC-065: counts unread messages per chat and in total, and clears them when the chat is opened", async () => {
    const [ali, bilal] = [await makeUser({ name: "Ali" }), await makeUser({ name: "Bilal" })];
    const ca = await connect(meId, ali.id);
    const cb = await connect(bilal.id, meId);
    await say(ca.id, ali.id, "1");
    await say(ca.id, ali.id, "2");
    await say(ca.id, meId, "my own message is never unread");
    await say(cb.id, bilal.id, "3");

    expect(await unreadTotal(meId)).toBe(3);
    const before = Object.fromEntries((await listConversations(meId)).map((c) => [c.name, c.unread]));
    expect(before).toEqual({ Ali: 2, Bilal: 1 });

    expect((await open(ca.id)).status).toBe(200);
    expect(await unreadTotal(meId)).toBe(1);
    expect((await testDb.message.findFirstOrThrow({ where: { body: "1" } })).readAt).not.toBeNull();
    // The sender's own messages stay unread for the other person until they open the chat
    expect(await unreadTotal(ali.id)).toBe(1);
  });

  it("does not count messages from connections that are no longer accepted", async () => {
    const ali = await makeUser();
    const c = await connect(meId, ali.id);
    await say(c.id, ali.id, "hi");
    await testDb.connection.update({ where: { id: c.id }, data: { status: ConnectionStatus.DECLINED } });
    expect(await unreadTotal(meId)).toBe(0);
  });

  it("opening someone else's chat marks nothing as read", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const c = await connect(a.id, b.id);
    await say(c.id, a.id, "private");
    expect((await open(c.id)).status).toBe(404);
    expect((await testDb.message.findFirstOrThrow()).readAt).toBeNull();
  });
});
