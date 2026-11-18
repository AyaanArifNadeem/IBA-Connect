import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleSender, setEmailSender } from "@/lib/email";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { sendRequest } from "@/lib/services/connections";
import { sendMessage } from "@/lib/services/messages";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
const blocksRoute = await import("@/app/api/v1/blocks/route");
const unblockRoute = await import("@/app/api/v1/blocks/[memberId]/route");

const meId = "9c9c9c9c-0000-4000-8000-000000000001";
const block = (memberId: string) =>
  blocksRoute.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ memberId }) }), {});
const unblock = (memberId: string) =>
  unblockRoute.DELETE(new Request("http://localhost/x", { method: "DELETE" }), { params: Promise.resolve({ memberId }) });

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: meId, name: "Me" });
  auth.getUser.mockResolvedValue({ data: { user: { id: meId, email: "me@x.test", email_confirmed_at: "2026-11-01T00:00:00Z" } }, error: null });
  vi.spyOn(console, "info").mockImplementation(() => {});
  setEmailSender(new ConsoleSender());
});
afterAll(async () => {
  setEmailSender(undefined);
  await testDb.$disconnect();
});

describe("block a member (FR3.7)", () => {
  it("TC-070: a blocked member can no longer send me a request, nor I to them", async () => {
    const ali = await makeUser({ name: "Ali" });
    expect((await block(ali.id)).status).toBe(201);
    await expect(sendRequest({ id: ali.id, name: "Ali" }, { recipientId: meId, note: "hi" })).rejects.toMatchObject({ status: 403 });
    await expect(sendRequest({ id: meId, name: "Me" }, { recipientId: ali.id, note: "hi" })).rejects.toMatchObject({ status: 403 });
  });

  it("TC-071: a blocked connection cannot message me", async () => {
    const ali = await makeUser();
    const c = await testDb.connection.create({ data: { requesterId: ali.id, recipientId: meId, contextNote: "x", status: ConnectionStatus.ACCEPTED } });
    await block(ali.id);
    await expect(sendMessage(ali.id, c.id, "hello?")).rejects.toMatchObject({ status: 403 });
  });

  it("closes pending requests between us", async () => {
    const ali = await makeUser();
    const c = await testDb.connection.create({ data: { requesterId: ali.id, recipientId: meId, contextNote: "x" } });
    await block(ali.id);
    expect((await testDb.connection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(ConnectionStatus.DECLINED);
  });

  it("lists blocked members, and unblocking lets them ask again", async () => {
    const ali = await makeUser({ name: "Ali Khan" });
    await block(ali.id);
    await block(ali.id); // twice is harmless
    const list = (await (await blocksRoute.GET(new Request("http://localhost/x"), {})).json()).data;
    expect(list).toEqual([expect.objectContaining({ id: ali.id, name: "Ali Khan" })]);

    expect((await unblock(ali.id)).status).toBe(204);
    expect(await testDb.block.count()).toBe(0);
    await testDb.connection.deleteMany(); // the closed request would otherwise start a cooldown
    await expect(sendRequest({ id: ali.id, name: "Ali" }, { recipientId: meId, note: "hi again" })).resolves.toBeTruthy();
  });

  it("refuses blocking yourself or an unknown member", async () => {
    expect((await block(meId)).status).toBe(400);
    expect((await block("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});
