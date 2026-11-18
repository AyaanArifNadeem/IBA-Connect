import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Supabase Auth is replaced by a fake; the database (rate limits, members) is real.
const auth = {
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const { POST: forgot } = await import("@/app/api/v1/auth/forgot-password/route");
const { POST: reset } = await import("@/app/api/v1/auth/reset-password/route");
const { POST: change } = await import("@/app/api/v1/auth/change-password/route");

let ip = 0;
const post = (url: string, body: unknown, from = `192.0.2.${++ip % 250}`) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": from },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await resetDatabase();
  Object.values(auth).forEach((fn) => fn.mockReset());
});
afterAll(() => testDb.$disconnect());

describe("POST /api/v1/auth/forgot-password", () => {
  it("TC-011: asks Supabase to email a reset link that comes back to the app", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const res = await forgot(post("/api/v1/auth/forgot-password", { email: " Sara@KHI.iba.edu.pk " }), {});
    expect(res.status).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("sara@khi.iba.edu.pk", {
      redirectTo: "http://localhost:3000/auth/confirm?type=recovery",
    });
  });

  it("gives the same answer when Supabase fails, so accounts cannot be discovered", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await forgot(post("/api/v1/auth/forgot-password", { email: "nobody@khi.iba.edu.pk" }), {});
    expect(res.status).toBe(200);
  });

  it("limits reset requests from one address (NFR20)", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    for (let i = 0; i < 5; i++) await forgot(post("/api/v1/auth/forgot-password", { email: "a@khi.iba.edu.pk" }, "192.0.2.250"), {});
    const res = await forgot(post("/api/v1/auth/forgot-password", { email: "a@khi.iba.edu.pk" }, "192.0.2.250"), {});
    expect(res.status).toBe(429);
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  it("TC-012: sets the new password and signs out every session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    auth.updateUser.mockResolvedValue({ error: null });
    const res = await reset(post("/api/v1/auth/reset-password", { password: "N3w!Passw0rd" }), {});
    expect(res.status).toBe(200);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "N3w!Passw0rd" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("refuses without the session opened by a reset link", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await reset(post("/api/v1/auth/reset-password", { password: "N3w!Passw0rd" }), {});
    expect(res.status).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("applies the full password rules", async () => {
    const res = await reset(post("/api/v1/auth/reset-password", { password: "longbutweak" }), {});
    expect(res.status).toBe(400);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("explains when the new password is the same as the old one", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    auth.updateUser.mockResolvedValue({ error: { code: "same_password" } });
    const res = await reset(post("/api/v1/auth/reset-password", { password: "N3w!Passw0rd" }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/different/);
  });
});

describe("POST /api/v1/auth/change-password", () => {
  const memberId = "3d7f2b1c-9a4e-4c2b-8f1a-1b2c3d4e5f60";
  const signedIn = () =>
    auth.getUser.mockResolvedValue({
      data: { user: { id: memberId, email: "sara@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
      error: null,
    });
  const body = { currentPassword: "Old!Pass123", newPassword: "Ch4nged!Pass", confirmPassword: "Ch4nged!Pass" };

  beforeEach(async () => {
    await makeUser({ id: memberId, email: "sara@khi.iba.edu.pk" });
  });

  it("TC-013: checks the current password, saves the new one and signs out other devices", async () => {
    signedIn();
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    const res = await change(post("/api/v1/auth/change-password", body), {});
    expect(res.status).toBe(200);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "sara@khi.iba.edu.pk", password: "Old!Pass123" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "Ch4nged!Pass" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("refuses a wrong current password", async () => {
    signedIn();
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const res = await change(post("/api/v1/auth/change-password", body), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Your current password is incorrect.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("TC-014: rejects a confirmation that does not match", async () => {
    signedIn();
    const res = await change(post("/api/v1/auth/change-password", { ...body, confirmPassword: "Other!Pass1" }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{ path: "confirmPassword", message: "Passwords do not match" }]);
  });

  it("requires a signed-in member", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await change(post("/api/v1/auth/change-password", body), {});
    expect(res.status).toBe(401);
  });
});
