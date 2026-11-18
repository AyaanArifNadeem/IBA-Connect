import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleSender, setEmailSender } from "@/lib/email";
import { ConnectionStatus, PostStatus } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
const { POST } = await import("@/app/api/v1/posts/[id]/responses/route");

const meId = "cccc0000-0000-4000-8000-000000000001";
const DAY = 86_400_000;
let mail: ConsoleSender;
let sara: { id: string };
const respond = (postId: string, message = "I can help, I took CSE341 last year.") =>
  POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ message }) }), { params: Promise.resolve({ id: postId }) });
const post = (authorId: string, data: Record<string, unknown> = {}) =>
  testDb.post.create({ data: { authorId, type: "STUDY_PARTNER", title: "CSE341 study buddy", body: "x", expiresAt: new Date(Date.now() + 14 * DAY), ...data } });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Ali Khan" });
  sara = await makeUser({ name: "Sara Raza", email: "sara@khi.iba.edu.pk" });
  auth.getUser.mockResolvedValue({ data: { user: { id: meId, email: "ali@x.test", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
  vi.spyOn(console, "info").mockImplementation(() => {});
  mail = new ConsoleSender();
  setEmailSender(mail);
});
afterAll(async () => {
  setEmailSender(undefined);
  await testDb.$disconnect();
});

describe("respond to a post (FR4.3, US4.3)", () => {
  it("TC-078: opens a connection request carrying the post, which the poster sees", async () => {
    const p = await post(sara.id);
    const res = await respond(p.id);
    expect(res.status).toBe(201);

    const connection = await testDb.connection.findFirstOrThrow();
    expect(connection).toMatchObject({ requesterId: meId, recipientId: sara.id, originPostId: p.id, status: ConnectionStatus.PENDING, contextNote: "I can help, I took CSE341 last year." });
    expect(await testDb.postResponse.findFirstOrThrow()).toMatchObject({ postId: p.id, responderId: meId, connectionId: connection.id });
    expect(mail.sent[0].to.email).toBe("sara@khi.iba.edu.pk");
    expect(mail.sent[0].text).toContain('about your post "CSE341 study buddy"');
  });

  it("TC-079: refuses a response to your own post", async () => {
    const mine = await post(meId);
    const res = await respond(mine.id);
    expect(res.status).toBe(400);
    expect(await testDb.connection.count()).toBe(0);
  });

  it("TC-080: the daily request limit applies to responses", async () => {
    for (let i = 0; i < 10; i++) {
      const other = await makeUser();
      await testDb.connection.create({ data: { requesterId: meId, recipientId: other.id, contextNote: "x" } });
    }
    const p = await post(sara.id);
    const res = await respond(p.id);
    expect(res.status).toBe(429);
    expect(await testDb.postResponse.count()).toBe(0);
  });

  it("refuses closed and expired posts", async () => {
    const closed = await post(sara.id, { status: PostStatus.CLOSED });
    const expired = await post(sara.id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await respond(closed.id)).status).toBe(409);
    expect((await respond(expired.id)).status).toBe(409);
  });

  it("refuses a second response to the same post", async () => {
    const p = await post(sara.id);
    await respond(p.id);
    await testDb.connection.updateMany({ data: { status: ConnectionStatus.DECLINED, respondedAt: new Date(Date.now() - 10 * DAY) } });
    const again = await respond(p.id);
    expect(again.status).toBe(409);
    expect((await again.json()).error.message).toBe("You already responded to this post.");
  });

  it("refuses when either member blocked the other, and for unknown posts", async () => {
    const p = await post(sara.id);
    await testDb.block.create({ data: { blockerId: sara.id, blockedId: meId } });
    expect((await respond(p.id)).status).toBe(403);
    expect((await respond("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("validates the reply", async () => {
    const p = await post(sara.id);
    expect((await respond(p.id, "")).status).toBe(400);
    expect((await respond(p.id, "a".repeat(301))).status).toBe(400);
  });
});
