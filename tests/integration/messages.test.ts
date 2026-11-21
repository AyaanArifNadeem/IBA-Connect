import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { listConversations } from "@/lib/services/messages";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const { GET, POST } = await import("@/app/api/v1/connections/[id]/messages/route");

const meId = "6f6f6f6f-0000-4000-8000-000000000001";
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const send = (id: string, body: string) => POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ body }) }), ctx(id));
const read = async (id: string, query = "") => GET(new Request(`http://localhost/x${query}`), ctx(id));
const connect = (a: string, b: string, status: ConnectionStatus = ConnectionStatus.ACCEPTED) =>
  testDb.connection.create({ data: { requesterId: a, recipientId: b, contextNote: "Hi", status, respondedAt: new Date() } });

let ali: { id: string };
beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Me" });
  ali = await makeUser({ name: "Ali Khan" });
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("private chat (FR3.4, US3.5)", () => {
  it("TC-063: both members send and read messages in order with their time", async () => {
    const c = await connect(meId, ali.id);
    expect((await send(c.id, "Hi Ali")).status).toBe(201);
    signInAs(ali.id);
    await send(c.id, "Hello!");
    await send(c.id, "How can I help?");
    signInAs(meId);
    const messages = (await (await read(c.id)).json()).data;
    expect(messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([
      ["Hi Ali", true],
      ["Hello!", false],
      ["How can I help?", false],
    ]);
    expect(messages[0].sentAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("TC-064: refuses messages before the request is accepted, and after a decline", async () => {
    const pending = await connect(meId, ali.id, ConnectionStatus.PENDING);
    const res = await send(pending.id, "Hello?");
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toMatch(/once the connection request is accepted/);
    await testDb.connection.update({ where: { id: pending.id }, data: { status: ConnectionStatus.DECLINED } });
    expect((await send(pending.id, "Hello?")).status).toBe(403);
    expect(await testDb.message.count()).toBe(0);
  });

  it("hides other members' conversations completely", async () => {
    const other = await makeUser();
    const c = await connect(ali.id, other.id);
    expect((await read(c.id)).status).toBe(404);
    expect((await send(c.id, "sneaky")).status).toBe(404);
    expect((await read("not-a-uuid")).status).toBe(404);
  });

  it("TC-072 / TC-073: text only, 1 to 2,000 characters, trimmed", async () => {
    const c = await connect(meId, ali.id);
    expect((await send(c.id, "a".repeat(2001))).status).toBe(400);
    expect((await send(c.id, "   \n ")).status).toBe(400);
    expect((await send(c.id, `  ${"a".repeat(2000)}  `)).status).toBe(201);
    expect((await testDb.message.findFirstOrThrow()).body).toHaveLength(2000);
  });

  it("TC-074: polling with `after` returns only newer messages", async () => {
    const c = await connect(meId, ali.id);
    const first = (await (await send(c.id, "one")).json()).data;
    await new Promise((r) => setTimeout(r, 5));
    await send(c.id, "two");
    const newer = (await (await read(c.id, `?after=${encodeURIComponent(first.sentAt)}`)).json()).data;
    expect(newer.map((m: { body: string }) => m.body)).toEqual(["two"]);
    expect((await read(c.id, "?after=yesterday")).status).toBe(400);
  });

  it("TC-071: refuses messages when either member blocked the other (FR3.7)", async () => {
    const c = await connect(meId, ali.id);
    await testDb.block.create({ data: { blockerId: ali.id, blockedId: meId } });
    expect((await send(c.id, "hi")).status).toBe(403);
  });

  it("limits sending to 30 messages a minute", async () => {
    const c = await connect(meId, ali.id);
    for (let i = 0; i < 30; i++) await send(c.id, `m${i}`);
    expect((await send(c.id, "one more")).status).toBe(429);
  });

  it("lists conversations with the latest message first", async () => {
    const [a, b] = [ali, await makeUser({ name: "Bilal" })];
    const ca = await connect(meId, a.id);
    const cb = await connect(b.id, meId);
    await send(ca.id, "older");
    await new Promise((r) => setTimeout(r, 5));
    await send(cb.id, "newest");
    const list = await listConversations(meId);
    expect(list.map((c) => [c.name, c.lastMessage?.preview])).toEqual([
      ["Bilal", "newest"],
      ["Ali Khan", "older"],
    ]);
  });
});
