import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus, Role } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

/**
 * US3.7 / FR3.5 / NFR10: a member's email is visible to another member only after a connection
 * is accepted. This sweeps every API a member can call about other members.
 */
const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const members = await import("@/app/api/v1/members/route");
const member = await import("@/app/api/v1/members/[id]/route");
const connections = await import("@/app/api/v1/connections/route");
const messages = await import("@/app/api/v1/connections/[id]/messages/route");

const meId = "8b8b8b8b-0000-4000-8000-000000000001";
const SECRET = "nida.private@khi.iba.edu.pk";
const PERSONAL = "nida.home@example.test";
let nidaId: string;

const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@x.test`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });

/** Every response a member can get about Nida, as raw text. */
async function everything(connectionId?: string) {
  const texts = [
    await (await members.GET(new Request("http://localhost/x"), {})).text(),
    await (await members.GET(new Request("http://localhost/x?q=nida"), {})).text(),
    await (await members.GET(new Request("http://localhost/x?alumni=1"), {})).text(),
    await (await member.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: nidaId }) })).text(),
  ];
  for (const view of ["incoming", "outgoing", "accepted"]) {
    texts.push(await (await connections.GET(new Request(`http://localhost/x?view=${view}`), {})).text());
  }
  if (connectionId) {
    texts.push(await (await messages.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: connectionId }) })).text());
  }
  return texts.join("\n");
}

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Me" });
  nidaId = (await makeUser({ name: "Nida Alumna", email: SECRET, personalEmail: PERSONAL, role: Role.ALUMNUS, field: "Consulting", company: "Fabrikam" })).id;
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("contact visibility (US3.7, FR3.5)", () => {
  it("TC-066: no email anywhere without a connection", async () => {
    const all = await everything();
    expect(all).toContain("Nida Alumna");
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain(PERSONAL);
  });

  it("TC-066: no email while the request is pending, or after it is declined", async () => {
    const c = await testDb.connection.create({ data: { requesterId: meId, recipientId: nidaId, contextNote: "hi" } });
    expect(await everything(c.id)).not.toContain(SECRET);
    await testDb.connection.update({ where: { id: c.id }, data: { status: ConnectionStatus.DECLINED, respondedAt: new Date() } });
    expect(await everything(c.id)).not.toContain(SECRET);
  });

  it("TC-067: each side sees the other's email once the connection is accepted", async () => {
    await testDb.connection.create({ data: { requesterId: meId, recipientId: nidaId, contextNote: "hi", status: ConnectionStatus.ACCEPTED, respondedAt: new Date() } });
    const profile = (await (await member.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: nidaId }) })).json()).data;
    expect(profile.email).toBe(SECRET);

    signInAs(nidaId);
    const mine = (await (await member.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: meId }) })).json()).data;
    expect(mine.email).toMatch(/@/);
  });

  it("the personal email used for alumni verification is never shared, even with connections", async () => {
    await testDb.connection.create({ data: { requesterId: meId, recipientId: nidaId, contextNote: "hi", status: ConnectionStatus.ACCEPTED, respondedAt: new Date() } });
    expect(await everything()).not.toContain(PERSONAL);
  });
});
