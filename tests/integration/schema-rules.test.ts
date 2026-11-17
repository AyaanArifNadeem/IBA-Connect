import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConnectionStatus } from "@/lib/generated/prisma/client";
import { makeUser, resetDatabase, testDb } from "./helpers";

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

describe("database rules (migration 'init')", () => {
  it("rejects a connection request to yourself", async () => {
    const a = await makeUser();
    await expect(
      testDb.connection.create({ data: { requesterId: a.id, recipientId: a.id, contextNote: "hi" } }),
    ).rejects.toThrow();
  });

  it("allows only one pending or accepted connection per pair, in either direction", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await testDb.connection.create({ data: { requesterId: a.id, recipientId: b.id, contextNote: "first" } });

    await expect(
      testDb.connection.create({ data: { requesterId: b.id, recipientId: a.id, contextNote: "reverse" } }),
    ).rejects.toThrow();
  });

  it("allows a new request after the previous one was declined", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await testDb.connection.create({
      data: { requesterId: a.id, recipientId: b.id, contextNote: "first", status: ConnectionStatus.DECLINED },
    });

    await expect(
      testDb.connection.create({ data: { requesterId: a.id, recipientId: b.id, contextNote: "again" } }),
    ).resolves.toMatchObject({ status: ConnectionStatus.PENDING });
  });

  it("rejects blocking yourself", async () => {
    const a = await makeUser();
    await expect(testDb.block.create({ data: { blockerId: a.id, blockedId: a.id } })).rejects.toThrow();
  });

  it("limits a message to 2,000 characters (FR3.8)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await testDb.connection.create({
      data: { requesterId: a.id, recipientId: b.id, contextNote: "x", status: ConnectionStatus.ACCEPTED },
    });

    await expect(
      testDb.message.create({ data: { connectionId: c.id, senderId: a.id, body: "a".repeat(2001) } }),
    ).rejects.toThrow();
    await expect(
      testDb.message.create({ data: { connectionId: c.id, senderId: a.id, body: "a".repeat(2000) } }),
    ).resolves.toBeTruthy();
  });

  it("keeps the email unique across members", async () => {
    await makeUser({ email: "same@member.test" });
    await expect(makeUser({ email: "same@member.test" })).rejects.toThrow();
  });

  it("has row-level security switched on for every application table (NFR7)", async () => {
    const rows = await testDb.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });
});
