import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConnectionStatus, PostStatus } from "@/lib/generated/prisma/enums";
import { getDashboard } from "@/lib/services/dashboard";
import { makeUser, resetDatabase, testDb } from "./helpers";

const meId = "f0f0f0f0-0000-4000-8000-000000000001";
const DAY = 86_400_000;

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Me" });
});
afterAll(() => testDb.$disconnect());

describe("dashboard (FR1.7)", () => {
  it("TC-032: shows 2 pending requests, 1 unread message and 1 open post", async () => {
    const [a, b, c] = await Promise.all([makeUser({ name: "Ali" }), makeUser({ name: "Bilal" }), makeUser({ name: "Carla" })]);
    await testDb.connection.create({ data: { requesterId: a.id, recipientId: meId, contextNote: "hi" } });
    await testDb.connection.create({ data: { requesterId: b.id, recipientId: meId, contextNote: "hello" } });
    const chat = await testDb.connection.create({ data: { requesterId: meId, recipientId: c.id, contextNote: "x", status: ConnectionStatus.ACCEPTED } });
    await testDb.message.create({ data: { connectionId: chat.id, senderId: c.id, body: "See you at 5" } });
    await testDb.message.create({ data: { connectionId: chat.id, senderId: meId, body: "Great" } });
    await testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "Open one", body: "x", expiresAt: new Date(Date.now() + 5 * DAY) } });
    await testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "Closed one", body: "x", status: PostStatus.CLOSED, expiresAt: new Date(Date.now() + 5 * DAY) } });
    await testDb.post.create({ data: { authorId: meId, type: "STUDY_PARTNER", title: "Expired one", body: "x", expiresAt: new Date(Date.now() - 1000) } });

    const d = await getDashboard(meId);
    expect(d.counts).toEqual({ pendingRequests: 2, unreadMessages: 1, openPosts: 1, connections: 1 });
    expect(d.pendingRequests.map((r) => r.person.name).sort()).toEqual(["Ali", "Bilal"]);
    expect(d.unreadChats).toEqual([expect.objectContaining({ name: "Carla", unread: 1 })]);
    expect(d.openPosts.map((p) => p.title)).toEqual(["Open one"]);
  });

  it("is empty for a new member", async () => {
    const d = await getDashboard(meId);
    expect(d.counts).toEqual({ pendingRequests: 0, unreadMessages: 0, openPosts: 0, connections: 0 });
    expect(d.pendingRequests).toEqual([]);
  });

  it("shows at most 5 items in each list", async () => {
    for (let i = 0; i < 7; i++) {
      const other = await makeUser();
      await testDb.connection.create({ data: { requesterId: other.id, recipientId: meId, contextNote: "hi" } });
    }
    const d = await getDashboard(meId);
    expect(d.counts.pendingRequests).toBe(7);
    expect(d.pendingRequests).toHaveLength(5);
  });
});
