import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Count the read-status writes the route makes, but let them run
const markReadSpy = vi.fn();
vi.mock("@/lib/services/messages", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/services/messages")>();
  return {
    ...real,
    markRead: (...args: Parameters<typeof real.markRead>) => {
      markReadSpy(...args);
      return real.markRead(...args);
    },
  };
});

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET } = await import("@/app/api/v1/connections/[id]/messages/route");
const { getConversation, listConversationMessages, listMessages } = await import("@/lib/services/messages");

const meId = "7a7a7a7a-0000-4000-8000-000000000001";
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const poll = (id: string, query = "") => GET(new Request(`http://localhost/x${query}`), ctx(id));

let ali: { id: string };
let connectionId: string;
beforeEach(async () => {
  await resetDatabase();
  markReadSpy.mockClear();
  await makeUser({ id: meId, name: "Me" });
  ali = await makeUser({ name: "Ali Khan" });
  connectionId = (
    await testDb.connection.create({ data: { requesterId: meId, recipientId: ali.id, contextNote: "Hi", status: ConnectionStatus.ACCEPTED, respondedAt: new Date() } })
  ).id;
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("chat polling does no needless work (Issue 4)", () => {
  it("an empty poll does not write read receipts", async () => {
    const sentAt = new Date("2026-11-20T10:00:00Z");
    await testDb.message.create({ data: { connectionId, senderId: ali.id, body: "Hi", sentAt, readAt: new Date() } });
    const res = await poll(connectionId, `?after=${encodeURIComponent(sentAt.toISOString())}`);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it("a poll that delivers a new incoming message marks it as read", async () => {
    const after = new Date("2026-11-20T10:00:00Z");
    await testDb.message.create({ data: { connectionId, senderId: ali.id, body: "New!", sentAt: new Date("2026-11-20T10:01:00Z") } });
    const res = await poll(connectionId, `?after=${encodeURIComponent(after.toISOString())}`);
    expect((await res.json()).data.map((m: { body: string }) => m.body)).toEqual(["New!"]);
    expect(markReadSpy).toHaveBeenCalledTimes(1);
    expect(await testDb.message.count({ where: { connectionId, readAt: null } })).toBe(0);
  });

  it("a poll that only returns my own messages makes no write", async () => {
    await testDb.message.create({ data: { connectionId, senderId: meId, body: "Mine", sentAt: new Date("2026-11-20T10:01:00Z") } });
    await poll(connectionId, `?after=${encodeURIComponent("2026-11-20T10:00:00.000Z")}`);
    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it("loading the whole chat (no `after`) still marks everything read, even with nothing new", async () => {
    await testDb.message.create({ data: { connectionId, senderId: ali.id, body: "Old", sentAt: new Date("2026-11-20T10:01:00Z") } });
    await poll(connectionId);
    expect(markReadSpy).toHaveBeenCalledTimes(1);
    expect(await testDb.message.count({ where: { connectionId, readAt: null } })).toBe(0);
  });
});

describe("access rules are unchanged by the faster message query", () => {
  it("a stranger gets 404 and sees nothing, and nothing is marked read", async () => {
    await testDb.message.create({ data: { connectionId, senderId: ali.id, body: "Secret", sentAt: new Date() } });
    const stranger = await makeUser({ name: "Stranger" });
    signInAs(stranger.id);
    const res = await poll(connectionId);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain("Secret");
    expect(await testDb.message.count({ where: { readAt: null } })).toBe(1);
  });

  it("a pending request is refused with 403 and no messages", async () => {
    await testDb.connection.update({ where: { id: connectionId }, data: { status: ConnectionStatus.PENDING } });
    await testDb.message.create({ data: { connectionId, senderId: ali.id, body: "Too early", sentAt: new Date() } });
    const res = await poll(connectionId);
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("Too early");
  });

  it("an unknown connection is a 404", async () => {
    expect((await poll("00000000-0000-4000-8000-0000000000ff")).status).toBe(404);
  });

  it("the page path returns the same messages as the API path", async () => {
    await testDb.message.createMany({
      data: [
        { connectionId, senderId: ali.id, body: "One", sentAt: new Date("2026-11-20T10:01:00Z") },
        { connectionId, senderId: meId, body: "Two", sentAt: new Date("2026-11-20T10:02:00Z") },
      ],
    });
    const conversation = await getConversation(meId, connectionId);
    expect(await listConversationMessages(meId, conversation)).toEqual(await listMessages(meId, connectionId));
  });
});
