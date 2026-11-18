import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { COOLDOWN_DAYS, DAY_MS } from "@/lib/services/connections";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const listRoute = await import("@/app/api/v1/connections/route");
const itemRoute = await import("@/app/api/v1/connections/[id]/route");

const meId = "5e5e5e5e-1111-4000-8000-000000000001";
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@khi.iba.edu.pk`, email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
const answer = (id: string, action: string) =>
  itemRoute.PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ action }) }), { params: Promise.resolve({ id }) });
const inbox = async (view: string) => (await (await listRoute.GET(new Request(`http://localhost/x?view=${view}`), {})).json()).data;
const request = (from: string, to: string, data: Record<string, unknown> = {}) =>
  testDb.connection.create({ data: { requesterId: from, recipientId: to, contextNote: "Can you help?", ...data } });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Me", email: "me@khi.iba.edu.pk" });
  signInAs(meId);
});
afterAll(() => testDb.$disconnect());

describe("accept or decline (FR3.2, US3.3)", () => {
  it("TC-059: accepting creates the connection", async () => {
    const ali = await makeUser({ name: "Ali" });
    const c = await request(ali.id, meId);
    const res = await answer(c.id, "accept");
    expect((await res.json()).data.status).toBe("ACCEPTED");
    expect(await testDb.connection.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: ConnectionStatus.ACCEPTED, respondedAt: expect.any(Date) });
  });

  it("TC-060: declining shows as declined to the requester, with the cooldown", async () => {
    const ali = await makeUser({ name: "Ali" });
    const c = await request(ali.id, meId);
    await answer(c.id, "decline");
    signInAs(ali.id);
    const outgoing = await inbox("outgoing");
    expect(outgoing.items[0]).toMatchObject({ status: "DECLINED", cooldownDays: COOLDOWN_DAYS, email: null });
  });

  it("TC-061: only the recipient can answer; others cannot even see it", async () => {
    const ali = await makeUser();
    const c = await request(meId, ali.id);
    expect((await answer(c.id, "accept")).status).toBe(403); // I sent it
    const stranger = await makeUser();
    signInAs(stranger.id);
    expect((await answer(c.id, "accept")).status).toBe(404);
    expect((await testDb.connection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(ConnectionStatus.PENDING);
  });

  it("refuses to answer twice", async () => {
    const ali = await makeUser();
    const c = await request(ali.id, meId);
    await answer(c.id, "decline");
    expect((await answer(c.id, "accept")).status).toBe(409);
  });
});

describe("requests inbox (FR3.3, US3.4)", () => {
  it("TC-062: separates incoming, outgoing and accepted, with person, note and status", async () => {
    const [a, b, c, d] = await Promise.all(["Ali", "Bilal", "Carla", "Dania"].map((name) => makeUser({ name, email: `${name.toLowerCase()}@khi.iba.edu.pk` })));
    await request(a.id, meId);
    await request(meId, b.id);
    await request(meId, c.id, { status: ConnectionStatus.DECLINED, respondedAt: new Date() });
    await request(d.id, meId, { status: ConnectionStatus.ACCEPTED, respondedAt: new Date() });

    const incoming = await inbox("incoming");
    expect(incoming.counts).toEqual({ incoming: 1, outgoing: 2, accepted: 1 });
    expect(incoming.items).toEqual([expect.objectContaining({ person: { id: a.id, name: "Ali" }, note: "Can you help?", status: "PENDING", email: null })]);
    expect((await inbox("outgoing")).items.map((i: { person: { name: string } }) => i.person.name).sort()).toEqual(["Bilal", "Carla"]);
    // TC-067: email shown for accepted connections only
    expect((await inbox("accepted")).items).toEqual([expect.objectContaining({ person: { id: d.id, name: "Dania" }, email: "dania@khi.iba.edu.pk" })]);
  });

  it("TC-090: never shows other members' requests", async () => {
    const [b, c] = await Promise.all([makeUser(), makeUser()]);
    await request(b.id, c.id);
    for (const view of ["incoming", "outgoing", "accepted"]) expect((await inbox(view)).items).toEqual([]);
  });

  it("shows the post a request came from", async () => {
    const ali = await makeUser();
    const post = await testDb.post.create({
      data: { authorId: meId, type: "STUDY_PARTNER", title: "CSE341 study buddy", body: "x", expiresAt: new Date(Date.now() + 14 * DAY_MS) },
    });
    await request(ali.id, meId, { originPostId: post.id });
    expect((await inbox("incoming")).items[0].viaPost).toEqual({ id: post.id, title: "CSE341 study buddy" });
  });

  it("rejects an unknown view", async () => {
    expect((await listRoute.GET(new Request("http://localhost/x?view=spam"), {})).status).toBe(400);
  });
});
