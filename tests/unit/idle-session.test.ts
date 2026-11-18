import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { idleLimitMs, isIdleExpired, shouldTouch } from "@/lib/auth/idle";

const DAY = 86_400_000;

describe("idle session rules (FR1.6)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to 7 days and can be configured", () => {
    expect(idleLimitMs()).toBe(7 * DAY);
    vi.stubEnv("SESSION_IDLE_DAYS", "2");
    expect(idleLimitMs()).toBe(2 * DAY);
    vi.stubEnv("SESSION_IDLE_DAYS", "nonsense");
    expect(idleLimitMs()).toBe(7 * DAY);
  });

  it("expires only when the last activity is older than the limit", () => {
    const now = 100 * DAY;
    expect(isIdleExpired(String(now - 8 * DAY), now)).toBe(true);
    expect(isIdleExpired(String(now - 6 * DAY), now)).toBe(false);
    expect(isIdleExpired(undefined, now)).toBe(false);
    expect(isIdleExpired("garbage", now)).toBe(false);
  });

  it("refreshes the cookie at most every five minutes", () => {
    const now = 100 * DAY;
    expect(shouldTouch(String(now - 60_000), now)).toBe(false);
    expect(shouldTouch(String(now - 6 * 60_000), now)).toBe(true);
    expect(shouldTouch(undefined, now)).toBe(true);
  });
});

// A signed-in session, as seen by the proxy
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) } }),
}));

describe("proxy with a signed-in member", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function run(path: string, lastSeen?: number) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const { updateSession } = await import("@/lib/supabase/proxy");
    const request = new NextRequest(`http://localhost${path}`);
    if (lastSeen !== undefined) request.cookies.set("iba_last_seen", String(lastSeen));
    return updateSession(request);
  }

  it("TC-031: signs out a member who has been idle too long", async () => {
    const res = await run("/dashboard", Date.now() - 8 * DAY);
    expect(res.headers.get("location")).toBe("http://localhost/sign-out?reason=idle");
  });

  it("sends a signed-in member from the landing page to the dashboard", async () => {
    const res = await run("/", Date.now());
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("lets an active member through and records the activity", async () => {
    const res = await run("/dashboard", Date.now() - 10 * 60_000);
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("iba_last_seen")?.value).toMatch(/^\d+$/);
  });
});
