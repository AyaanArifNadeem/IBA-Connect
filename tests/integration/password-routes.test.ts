import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testDb } from "./helpers";

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
