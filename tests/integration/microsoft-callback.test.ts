import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, VerificationMethod } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { exchangeCodeForSession: vi.fn(), signOut: vi.fn() };
const admin = { deleteUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
  createAdminClient: () => ({ auth: { admin } }),
}));
const { GET } = await import("@/app/auth/callback/route");

const id = "5e5e5e5e-aaaa-4bbb-8ccc-dddddddddddd";
const iba = {
  id,
  email: "s.raza.12345@khi.iba.edu.pk",
  email_confirmed_at: "2026-11-18T00:00:00Z",
  app_metadata: { provider: "azure", providers: ["azure"] },
  user_metadata: { full_name: "Sara Raza" },
};
const callback = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`));

beforeEach(async () => {
  await resetDatabase();
  Object.values(auth).forEach((f) => f.mockReset());
  admin.deleteUser.mockReset();
});
afterAll(() => testDb.$disconnect());

describe("GET /auth/callback (FR1.1, US1.1)", () => {
  it("TC-001: creates the member on first sign-in and opens profile setup", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: iba }, error: null });
    const res = await callback("code=abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/profile/setup");
    expect(await testDb.user.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: "Sara Raza",
      email: iba.email,
      verificationMethod: VerificationMethod.MICROSOFT,
    });
  });

  it("TC-003: sends a returning member with a finished profile to where they were going", async () => {
    await makeUser({ id, email: iba.email });
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: iba }, error: null });
    const res = await callback("code=abc&next=/directory");
    expect(res.headers.get("location")).toBe("http://localhost:3000/directory");
  });

  it("TC-002: refuses a non-IBA account and deletes the auth account", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { ...iba, email: "someone@outlook.com" } }, error: null });
    const res = await callback("code=abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/sign-in?reason=not-iba");
    expect(auth.signOut).toHaveBeenCalled();
    expect(admin.deleteUser).toHaveBeenCalledWith(id);
    expect(await testDb.user.count()).toBe(0);
  });

  it("refuses an IBA address that Microsoft has not verified", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { ...iba, email_confirmed_at: null } }, error: null });
    expect((await callback("code=abc")).headers.get("location")).toContain("reason=not-iba");
    expect(await testDb.user.count()).toBe(0);
  });

  it("refuses look-alike domains", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { ...iba, email: "x@khi.iba.edu.pk.evil.test" } }, error: null });
    expect((await callback("code=abc")).headers.get("location")).toContain("reason=not-iba");
  });

  it("never deletes the auth account of an existing member", async () => {
    await makeUser({ id, email: "someone@outlook.com" });
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { ...iba, email: "someone@outlook.com" } }, error: null });
    await callback("code=abc");
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("signs a suspended member out", async () => {
    await makeUser({ id, email: iba.email, status: UserStatus.SUSPENDED });
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: iba }, error: null });
    expect((await callback("code=abc")).headers.get("location")).toBe("http://localhost:3000/sign-out?reason=suspended");
  });

  it("handles a missing or rejected code", async () => {
    expect((await callback("")).headers.get("location")).toContain("reason=microsoft-failed");
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { code: "bad_code_verifier" } });
    expect((await callback("code=bad")).headers.get("location")).toContain("reason=microsoft-failed");
  });
});
