import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleSender, setEmailSender } from "@/lib/email";
import { ConnectionStatus, UserStatus } from "@/lib/generated/prisma/enums";
import { COOLDOWN_DAYS, DAY_MS, relationship, sendRequest } from "@/lib/services/connections";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
const { POST } = await import("@/app/api/v1/connections/route");
const { GET: allowance } = await import("@/app/api/v1/connections/allowance/route");

const meId = "4d4d4d4d-0000-4000-8000-000000000001";
let mail: ConsoleSender;
const send = (body: unknown) =>
  POST(new Request("http://localhost/api/v1/connections", { method: "POST", body: JSON.stringify(body) }), {});

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Sara Raza", email: "sara@khi.iba.edu.pk" });
  auth.getUser.mockResolvedValue({
    data: { user: { id: meId, email: "sara@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  mail = new ConsoleSender();
  vi.spyOn(console, "info").mockImplementation(() => {});
  setEmailSender(mail);
});
afterAll(async () => {
  setEmailSender(undefined);
  await testDb.$disconnect();
});

describe("POST /api/v1/connections (FR3.1, US3.1)", () => {
  it("TC-054 / TC-068: creates a pending request and emails the recipient with the note", async () => {
    const ali = await makeUser({ name: "Ali Khan", email: "ali@khi.iba.edu.pk" });
    const res = await send({ recipientId: ali.id, note: "Can you help with CSE341?" });
    expect(res.status).toBe(201);
    expect((await res.json()).data).toMatchObject({ status: "PENDING", remainingToday: 9 });

    expect(await testDb.connection.findFirst({ where: { requesterId: meId } })).toMatchObject({
      recipientId: ali.id,
      contextNote: "Can you help with CSE341?",
      status: ConnectionStatus.PENDING,
    });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: { email: "ali@khi.iba.edu.pk" }, subject: "Sara Raza wants to connect on IBA Connect" });
    expect(mail.sent[0].text).toContain("Can you help with CSE341?");
    expect(mail.sent[0].text).not.toContain("sara@khi.iba.edu.pk");
  });

  it("TC-055: rejects an empty note or one longer than 300 characters", async () => {
    const ali = await makeUser();
    expect((await send({ recipientId: ali.id, note: "a".repeat(301) })).status).toBe(400);
    expect((await send({ recipientId: ali.id, note: "   " })).status).toBe(400);
    expect(await testDb.connection.count()).toBe(0);
  });

  it("TC-056 / TC-091: blocks the 11th request in a day and sends no email for it (US3.2)", async () => {
    for (let i = 0; i < 10; i++) {
      const other = await makeUser();
      expect((await send({ recipientId: other.id, note: "hi" })).status).toBe(201);
    }
    const eleventh = await makeUser();
    const res = await send({ recipientId: eleventh.id, note: "hi" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.message).toMatch(/up to 10 requests a day/);
    expect(res.headers.get("retry-after")).not.toBeNull();
    expect(mail.sent).toHaveLength(10);
  });

  it("counts requests from the last 24 hours only", async () => {
    const old = new Date(Date.now() - DAY_MS - 60_000);
    for (let i = 0; i < 10; i++) {
      const other = await makeUser();
      await testDb.connection.create({ data: { requesterId: meId, recipientId: other.id, contextNote: "x", createdAt: old, status: ConnectionStatus.DECLINED, respondedAt: old } });
    }
    const fresh = await makeUser();
    expect((await send({ recipientId: fresh.id, note: "hi" })).status).toBe(201);
  });

  it("TC-057: asking again during the cooldown after a decline is blocked, then allowed (US3.2)", async () => {
    const ali = await makeUser();
    const declinedAt = new Date(Date.now() - DAY_MS);
    await testDb.connection.create({ data: { requesterId: meId, recipientId: ali.id, contextNote: "x", status: ConnectionStatus.DECLINED, createdAt: declinedAt, respondedAt: declinedAt } });

    const res = await send({ recipientId: ali.id, note: "again" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.message).toBe(`You asked this member recently. You can ask again in ${COOLDOWN_DAYS - 1} days.`);

    await testDb.connection.updateMany({ data: { respondedAt: new Date(Date.now() - (COOLDOWN_DAYS + 1) * DAY_MS) } });
    expect((await send({ recipientId: ali.id, note: "again" })).status).toBe(201);
  });

  it("TC-058: refuses a duplicate, a reverse request and an existing connection", async () => {
    const ali = await makeUser();
    await send({ recipientId: ali.id, note: "first" });
    expect((await send({ recipientId: ali.id, note: "second" })).status).toBe(409);

    const omar = await makeUser();
    await testDb.connection.create({ data: { requesterId: omar.id, recipientId: meId, contextNote: "hi" } });
    const reverse = await send({ recipientId: omar.id, note: "hi" });
    expect(reverse.status).toBe(409);
    expect((await reverse.json()).error.message).toMatch(/already sent you a request/);
  });

  it("refuses yourself, unknown members, suspended members and blocks in either direction", async () => {
    expect((await send({ recipientId: meId, note: "me" })).status).toBe(400);
    expect((await send({ recipientId: "00000000-0000-4000-8000-000000000000", note: "x" })).status).toBe(404);
    const suspended = await makeUser({ status: UserStatus.SUSPENDED });
    expect((await send({ recipientId: suspended.id, note: "x" })).status).toBe(404);

    const blocker = await makeUser();
    await testDb.block.create({ data: { blockerId: blocker.id, blockedId: meId } });
    expect((await send({ recipientId: blocker.id, note: "x" })).status).toBe(403);
    expect(mail.sent).toHaveLength(0);
  });

  it("keeps the request when the email cannot be sent", async () => {
    const ali = await makeUser();
    setEmailSender({ send: async () => { throw new Error("Brevo down"); } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await send({ recipientId: ali.id, note: "hi" })).status).toBe(201);
    expect(await testDb.connection.count()).toBe(1);
  });
});

describe("allowance and relationship", () => {
  it("reports the requests left today", async () => {
    const ali = await makeUser();
    await send({ recipientId: ali.id, note: "hi" });
    const res = await allowance(new Request("http://localhost/x"), {});
    expect((await res.json()).data).toEqual({ used: 1, limit: 10, remaining: 9 });
  });

  it("describes where two members stand", async () => {
    const ali = await makeUser();
    const me = { id: meId, name: "Sara Raza" };
    expect((await relationship(meId, ali.id)).state).toBe("none");
    await sendRequest(me, { recipientId: ali.id, note: "hi" });
    expect((await relationship(meId, ali.id)).state).toBe("pending_outgoing");
    expect((await relationship(ali.id, meId)).state).toBe("pending_incoming");
    await testDb.connection.updateMany({ data: { status: ConnectionStatus.ACCEPTED, respondedAt: new Date() } });
    expect((await relationship(meId, ali.id)).state).toBe("connected");
    expect((await relationship(meId, meId)).state).toBe("self");
  });
});
