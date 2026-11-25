import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleSender, setEmailSender, type EmailMessage, type EmailSender } from "@/lib/email";
import { ConnectionStatus, UserStatus } from "@/lib/generated/prisma/enums";
import { MAX_ATTEMPTS, drainEmailOutbox, retryDelayMs } from "@/lib/services/email-outbox";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Inside a request, after() runs the callback once the response has been sent. Collect them here.
const afterCallbacks: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: (fn: () => unknown) => void afterCallbacks.push(fn),
}));
const runAfter = async () => {
  while (afterCallbacks.length) await afterCallbacks.shift()!();
};

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
const { POST } = await import("@/app/api/v1/connections/route");
const { GET: cron } = await import("@/app/api/v1/internal/email-outbox/route");

const meId = "5e5e5e5e-0000-4000-8000-000000000001";
const send = (body: unknown) => POST(new Request("http://localhost/api/v1/connections", { method: "POST", body: JSON.stringify(body) }), {});

class FlakySender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failures = 0;
  delayMs = 0;
  async send(message: EmailMessage) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("Brevo rejected the email (HTTP 503).");
    }
    this.sent.push(message);
  }
}

let mail: FlakySender;
let ali: { id: string };
beforeEach(async () => {
  await resetDatabase();
  afterCallbacks.length = 0;
  await makeUser({ id: meId, name: "Sara Raza", email: "sara@khi.iba.edu.pk" });
  ali = await makeUser({ name: "Ali Khan", email: "ali@khi.iba.edu.pk" });
  auth.getUser.mockResolvedValue({
    data: { user: { id: meId, email: "sara@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  mail = new FlakySender();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  setEmailSender(mail);
});
afterAll(async () => {
  setEmailSender(undefined);
  await testDb.$disconnect();
});

const outbox = () => testDb.emailOutbox.findMany();

describe("connection request email outbox (FR3.6, Issue 3)", () => {
  it("answers before the email is sent, and sends it once the response has gone", async () => {
    const res = await send({ recipientId: ali.id, note: "Can you help?" });
    expect(res.status).toBe(201);
    expect(mail.sent).toHaveLength(0); // the request did not wait for the email provider
    expect(await outbox()).toMatchObject([{ kind: "connection_request", attempts: 0, sentAt: null }]);

    await runAfter();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: { email: "ali@khi.iba.edu.pk" }, subject: "Sara Raza wants to connect on IBA Connect" });
    expect(mail.sent[0].text).toContain("Can you help?");
    expect(mail.sent[0].text).not.toContain("sara@khi.iba.edu.pk");
    expect((await outbox())[0].sentAt).not.toBeNull();
  });

  it("keeps the request when the email provider is down, and retries later without duplicates", async () => {
    mail.failures = 2;
    const res = await send({ recipientId: ali.id, note: "Hello" });
    expect(res.status).toBe(201);
    await runAfter();

    expect(await testDb.connection.count()).toBe(1);
    const [afterFailure] = await outbox();
    expect(afterFailure).toMatchObject({ attempts: 1, sentAt: null, failedAt: null });
    expect(afterFailure.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // Not due yet: nothing happens
    expect(await drainEmailOutbox()).toEqual({ sent: 0, retrying: 0, failed: 0, dropped: 0 });

    const later = new Date(Date.now() + 10 * 60_000);
    expect(await drainEmailOutbox({ now: later })).toMatchObject({ retrying: 1 }); // second failure
    const much = new Date(Date.now() + 60 * 60_000);
    expect(await drainEmailOutbox({ now: much })).toMatchObject({ sent: 1 });
    expect(await drainEmailOutbox({ now: new Date(Date.now() + 24 * 3_600_000) })).toMatchObject({ sent: 0 });

    expect(mail.sent).toHaveLength(1);
    expect((await outbox())[0]).toMatchObject({ attempts: 3 });
    expect((await outbox())[0].sentAt).not.toBeNull();
  });

  it("gives up after the maximum number of attempts", async () => {
    mail.failures = 1000;
    await send({ recipientId: ali.id, note: "Hello" });
    await runAfter();
    let clock = Date.now();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      clock += 7 * 3_600_000;
      await drainEmailOutbox({ now: new Date(clock) });
    }
    const [row] = await outbox();
    expect(row.attempts).toBe(MAX_ATTEMPTS);
    expect(row.failedAt).not.toBeNull();
    expect(mail.sent).toHaveLength(0);
    clock += 7 * 3_600_000;
    expect(await drainEmailOutbox({ now: new Date(clock) })).toEqual({ sent: 0, retrying: 0, failed: 0, dropped: 0 });
  });

  it("two workers draining at once send the email once", async () => {
    mail.delayMs = 50;
    await send({ recipientId: ali.id, note: "Hello" });
    afterCallbacks.length = 0; // we drive the workers ourselves
    const results = await Promise.all([drainEmailOutbox(), drainEmailOutbox(), drainEmailOutbox()]);
    expect(mail.sent).toHaveLength(1);
    expect(results.reduce((n, r) => n + r.sent, 0)).toBe(1);
  });

  it("does not email about a request that was answered or whose recipient has left", async () => {
    await send({ recipientId: ali.id, note: "Hello" });
    await testDb.connection.updateMany({ data: { status: ConnectionStatus.ACCEPTED, respondedAt: new Date() } });
    expect(await drainEmailOutbox()).toMatchObject({ dropped: 1, sent: 0 });
    expect(mail.sent).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);

    const bo = await makeUser({ name: "Bo", email: "bo@khi.iba.edu.pk" });
    await send({ recipientId: bo.id, note: "Hi Bo" });
    await testDb.user.update({ where: { id: bo.id }, data: { status: UserStatus.SUSPENDED } });
    expect(await drainEmailOutbox()).toMatchObject({ dropped: 1 });
    expect(mail.sent).toHaveLength(0);
  });

  it("allows one notification per connection, and removes it with the connection", async () => {
    await send({ recipientId: ali.id, note: "Hello" });
    const [row] = await outbox();
    await expect(testDb.emailOutbox.create({ data: { kind: row.kind, connectionId: row.connectionId } })).rejects.toMatchObject({ code: "P2002" });
    await testDb.connection.delete({ where: { id: row.connectionId } });
    expect(await outbox()).toHaveLength(0);
  });

  it("a Need Board response queues one email carrying the post title, and none when it is a duplicate", async () => {
    const post = await testDb.post.create({
      data: { authorId: ali.id, type: "STUDY_PARTNER", title: "CSE341 buddy", body: "Anyone?", expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const { POST: respond } = await import("@/app/api/v1/posts/[id]/responses/route");
    const call = () =>
      respond(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ message: "I can help" }) }), { params: Promise.resolve({ id: post.id }) });
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(409);
    await runAfter();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toContain("CSE341 buddy");
  });
});

describe("retry schedule", () => {
  it("doubles from one minute up to six hours", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(retryDelayMs(20)).toBe(6 * 3_600_000);
  });
});

describe("GET /api/v1/internal/email-outbox", () => {
  const call = (token?: string) => cron(new Request("http://localhost/api/v1/internal/email-outbox", { headers: token ? { authorization: `Bearer ${token}` } : {} }), {});

  it("does not exist without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("anything")).status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("refuses a missing or wrong secret and sends nothing", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    await send({ recipientId: ali.id, note: "Hello" });
    afterCallbacks.length = 0;
    expect((await call()).status).toBe(401);
    expect((await call("wrong-value!")).status).toBe(401);
    expect(mail.sent).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it("with the secret, sends what is due", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    mail.failures = 1;
    await send({ recipientId: ali.id, note: "Hello" });
    await runAfter(); // first attempt fails
    await testDb.emailOutbox.updateMany({ data: { nextAttemptAt: new Date(0) } }); // pretend the wait is over
    const res = await call("s3cret-value");
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ sent: 1 });
    expect(mail.sent).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});

// The console sender is what development uses; make sure the outbox works with it too
describe("with the development sender", () => {
  it("delivers through ConsoleSender", async () => {
    const sender = new ConsoleSender();
    vi.spyOn(console, "info").mockImplementation(() => {});
    setEmailSender(sender);
    await send({ recipientId: ali.id, note: "Hello" });
    await runAfter();
    expect(sender.sent).toHaveLength(1);
  });
});
