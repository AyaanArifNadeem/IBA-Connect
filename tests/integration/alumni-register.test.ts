import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AlumniRecordKind, Role, VerificationMethod } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { signUp: vi.fn() };
const admin = { deleteUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
  createAdminClient: () => ({ auth: { admin } }),
}));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const { POST } = await import("@/app/api/v1/auth/alumni-register/route");

let ip = 0;
const register = (body: unknown) =>
  POST(
    new Request("http://localhost/api/v1/auth/alumni-register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${++ip % 250}` },
      body: JSON.stringify(body),
    }),
    {},
  );

const base = { name: "Bilal Khan", email: "bilal.khan@example.test", password: "Str0ng!Pass" };
const newAuthUser = () => {
  const id = randomUUID();
  auth.signUp.mockResolvedValue({ data: { user: { id, identities: [{ id: "i" }] } }, error: null });
  return id;
};
const code = (data: Partial<{ inviteCode: string; expiresAt: Date; revokedAt: Date; claimedById: string }> = {}) =>
  testDb.alumniRecord.create({ data: { kind: AlumniRecordKind.CODE, inviteCode: "IBA-7KQ2-M9XD", ...data } });

beforeEach(async () => {
  await resetDatabase();
  auth.signUp.mockReset();
  admin.deleteUser.mockReset();
});
afterAll(() => testDb.$disconnect());

describe("POST /api/v1/auth/alumni-register (FR1.3, US1.4)", () => {
  it("TC-015: a valid code creates a verified alumnus and claims the code", async () => {
    const record = await code();
    const id = newAuthUser();
    const res = await register({ ...base, method: "code", code: " iba-7kq2-m9xd " });
    expect(res.status).toBe(201);

    expect(await testDb.user.findUniqueOrThrow({ where: { id } })).toMatchObject({
      role: Role.ALUMNUS,
      verificationMethod: VerificationMethod.ALUMNI_CODE,
      personalEmail: base.email,
    });
    expect((await testDb.alumniRecord.findUniqueOrThrow({ where: { id: record.id } })).claimedById).toBe(id);
  });

  it("TC-016: a personal email on the alumni list verifies the alumnus", async () => {
    await testDb.alumniRecord.create({ data: { kind: AlumniRecordKind.LIST_ENTRY, personalEmail: base.email } });
    const id = newAuthUser();
    const res = await register({ ...base, email: "Bilal.Khan@Example.test", method: "list" });
    expect(res.status).toBe(201);
    expect((await testDb.user.findUniqueOrThrow({ where: { id } })).verificationMethod).toBe(VerificationMethod.ALUMNI_LIST);
  });

  it.each([
    ["unknown", {}],
    ["expired", { expiresAt: new Date(Date.now() - 1000) }],
    ["revoked", { revokedAt: new Date() }],
  ])("TC-017: refuses an %s code and creates no account", async (label, data) => {
    if (label !== "unknown") await code(data);
    const res = await register({ ...base, method: "code", code: label === "unknown" ? "NOPE-0000" : "IBA-7KQ2-M9XD" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/could not verify you as an alumnus/);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await testDb.user.count()).toBe(0);
  });

  it("TC-018: refuses a code someone else already claimed", async () => {
    const other = await makeUser();
    await code({ claimedById: other.id });
    const res = await register({ ...base, method: "code", code: "IBA-7KQ2-M9XD" });
    expect(res.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("refuses an email that is not on the alumni list", async () => {
    const res = await register({ ...base, method: "list" });
    expect(res.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("sends people with an IBA email to the normal registration", async () => {
    const res = await register({ ...base, email: "x@khi.iba.edu.pk", method: "list" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].message).toMatch(/register with it instead/);
  });

  it("refuses an email that already has an account", async () => {
    await code();
    await makeUser({ email: base.email });
    const res = await register({ ...base, method: "code", code: "IBA-7KQ2-M9XD" });
    expect(res.status).toBe(409);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("undoes the new auth account if the code was claimed at the same moment", async () => {
    const record = await code();
    const id = newAuthUser();
    // Another alumnus claims the code between the check and the claim
    auth.signUp.mockImplementation(async () => {
      const winner = await makeUser();
      await testDb.alumniRecord.update({ where: { id: record.id }, data: { claimedById: winner.id } });
      return { data: { user: { id, identities: [{ id: "i" }] } }, error: null };
    });
    const res = await register({ ...base, method: "code", code: "IBA-7KQ2-M9XD" });
    expect(res.status).toBe(400);
    expect(admin.deleteUser).toHaveBeenCalledWith(id);
    expect(await testDb.user.findUnique({ where: { id } })).toBeNull();
  });
});
