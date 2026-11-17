import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, VerificationMethod } from "@/lib/generated/prisma/enums";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Supabase Auth is replaced by a fake; the database is real.
const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
  verifyOtp: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const { POST: register } = await import("@/app/api/v1/auth/register/route");
const { POST: signIn } = await import("@/app/api/v1/auth/sign-in/route");
const { GET: confirm } = await import("@/app/auth/confirm/route");

let ipCounter = 0;
const post = (url: string, body: unknown, ip = `198.51.100.${++ipCounter % 250}`) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await resetDatabase();
  Object.values(auth).forEach((fn) => fn.mockReset());
});
afterAll(() => testDb.$disconnect());

describe("POST /api/v1/auth/register (FR1.2)", () => {
  const valid = { name: "Sara Raza", email: "sara.raza@khi.iba.edu.pk", password: "Str0ng!Pass" };

  it("TC-004: registers through Supabase with a verification link back to the app", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "x" } }, error: null });
    const res = await register(post("/api/v1/auth/register", valid), {});
    expect(res.status).toBe(201);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "sara.raza@khi.iba.edu.pk",
      password: "Str0ng!Pass",
      options: {
        data: { name: "Sara Raza" },
        emailRedirectTo: "http://localhost:3000/auth/confirm?next=/profile/setup",
      },
    });
    // No member yet: it is created once the email is verified
    expect(await testDb.user.count()).toBe(0);
  });

  it("TC-005: rejects a weak password before contacting Supabase", async () => {
    const res = await register(post("/api/v1/auth/register", { ...valid, password: "abc12" }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_failed");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects a non-IBA email on the server too", async () => {
    const res = await register(post("/api/v1/auth/register", { ...valid, email: "sara@gmail.com" }), {});
    expect(res.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("gives an existing email the same answer as a new one", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists", message: "exists", status: 422 } });
    const res = await register(post("/api/v1/auth/register", valid), {});
    expect(res.status).toBe(201);
  });

  it("limits registrations from one address (NFR20)", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "x" } }, error: null });
    for (let i = 0; i < 5; i++) {
      expect((await register(post("/api/v1/auth/register", valid, "203.0.113.9"), {})).status).toBe(201);
    }
    const blocked = await register(post("/api/v1/auth/register", valid, "203.0.113.9"), {});
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });
});

describe("POST /api/v1/auth/sign-in (FR1.2)", () => {
  const creds = { email: "sara.raza@khi.iba.edu.pk", password: "Str0ng!Pass" };
  const authUser = { id: "6f1c1a52-6b7a-4d7e-9a43-0a3f1f7f3b11", email: creds.email, user_metadata: { name: "Sara Raza" } };

  it("creates the member on first sign-in and sends them to profile setup", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await signIn(post("/api/v1/auth/sign-in", creds), {});
    expect(res.status).toBe(200);
    expect((await res.json()).data.next).toBe("/profile/setup");

    const member = await testDb.user.findUniqueOrThrow({ where: { id: authUser.id } });
    expect(member).toMatchObject({ name: "Sara Raza", email: creds.email, verificationMethod: VerificationMethod.EMAIL });
  });

  it("sends a member with a finished profile to the dashboard", async () => {
    await makeUser({ id: authUser.id, email: creds.email });
    auth.signInWithPassword.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await signIn(post("/api/v1/auth/sign-in", creds), {});
    expect((await res.json()).data.next).toBe("/dashboard");
  });

  it("TC-008: refuses a wrong password with a neutral message", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await signIn(post("/api/v1/auth/sign-in", creds), {});
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe("Incorrect email or password.");
  });

  it("TC-006: refuses an unverified email", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "email_not_confirmed" } });
    const res = await signIn(post("/api/v1/auth/sign-in", creds), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("email_not_verified");
  });

  it("TC-030: signs a suspended member straight back out", async () => {
    await makeUser({ id: authUser.id, email: creds.email, status: UserStatus.SUSPENDED });
    auth.signInWithPassword.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await signIn(post("/api/v1/auth/sign-in", creds), {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("suspended");
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("TC-009: blocks the 11th attempt within 15 minutes (NFR20)", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 10; i++) await signIn(post("/api/v1/auth/sign-in", creds, "203.0.113.20"), {});
    const res = await signIn(post("/api/v1/auth/sign-in", creds, "203.0.113.20"), {});
    expect(res.status).toBe(429);
  });
});

describe("GET /auth/confirm (email links)", () => {
  const authUser = { id: "0b8b7b9e-3c58-4a8e-9a55-5f0f1a0f2c22", email: "new@khi.iba.edu.pk", user_metadata: { name: "New Member" } };
  const get = (query: string) => new NextRequest(`http://localhost:3000/auth/confirm?${query}`);

  it("TC-007: verifies the email, creates the member and opens profile setup", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await confirm(get("token_hash=abc&type=signup&next=/profile/setup"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/profile/setup");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(await testDb.user.findUnique({ where: { id: authUser.id } })).not.toBeNull();
  });

  it("sends an expired link to the verify page", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired" } });
    const res = await confirm(get("token_hash=old&type=signup"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/verify?error=expired");
  });

  it("rejects a link without a token or with an unknown type", async () => {
    expect((await confirm(get("type=signup"))).headers.get("location")).toContain("error=invalid");
    expect((await confirm(get("token_hash=a&type=hack"))).headers.get("location")).toContain("error=invalid");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("never redirects outside the app", async () => {
    await makeUser({ id: authUser.id, email: authUser.email });
    auth.verifyOtp.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await confirm(get("token_hash=abc&type=signup&next=https://evil.test"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
