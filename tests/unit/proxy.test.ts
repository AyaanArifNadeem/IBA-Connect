import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAST_SEEN_COOKIE } from "@/lib/auth/idle";
import { isProtectedPath, updateSession } from "@/lib/supabase/proxy";

describe("isProtectedPath", () => {
  it("protects member pages and their sub-pages", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/members/123")).toBe(true);
    expect(isProtectedPath("/admin/courses")).toBe(true);
  });

  it("leaves public pages open", () => {
    for (const path of ["/", "/sign-in", "/register", "/verify", "/auth/confirm", "/api/v1/health", "/boards-of-x"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });
});

describe("updateSession without a session", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("TC-029: redirects a signed-out visitor from a member page to sign-in, keeping the target", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await updateSession(new NextRequest("http://localhost/directory?course=CSE341"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/sign-in?next=%2Fdirectory%3Fcourse%3DCSE341",
    );
  });

  it("lets a signed-out visitor see public pages", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await updateSession(new NextRequest("http://localhost/register"));
    expect(response.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------- Auth work per request type

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: { getClaims } })) }));

const SESSION = { name: "sb-abcdefgh-auth-token", value: "session" };
const request = (path: string, cookies: { name: string; value: string }[] = []) =>
  new NextRequest(`http://localhost${path}`, { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });

describe("updateSession auth work", () => {
  beforeEach(() => {
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("verifies the session once for a page request that carries a session cookie", async () => {
    const response = await updateSession(request("/directory", [SESSION]));
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBeNull();
  });

  it("recognises a chunked session cookie", async () => {
    await updateSession(request("/directory", [{ name: "sb-abcdefgh-auth-token.0", value: "a" }]));
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("does no auth work for a visitor without a session cookie, and still protects member pages", async () => {
    const response = await updateSession(request("/directory"));
    expect(getClaims).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/sign-in?next=%2Fdirectory");
  });

  it("does not treat the OAuth code-verifier cookie as a session", async () => {
    await updateSession(request("/register", [{ name: "sb-abcdefgh-auth-token-code-verifier", value: "x" }]));
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("leaves session verification to the route handler for API requests", async () => {
    const response = await updateSession(request("/api/v1/connections", [SESSION]));
    expect(getClaims).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });

  it("still verifies the session for the auth endpoints", async () => {
    await updateSession(request("/api/v1/auth/sign-in", [SESSION]));
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("FR1.6: an idle session is signed out on an API request too", async () => {
    const longAgo = String(Date.now() - 30 * 86_400_000);
    const response = await updateSession(request("/api/v1/connections/x/messages", [SESSION, { name: LAST_SEEN_COOKIE, value: longAgo }]));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/sign-out?reason=idle");
  });

  it("FR1.6: an API request renews the last-seen cookie", async () => {
    const response = await updateSession(request("/api/v1/connections/x/messages", [SESSION]));
    expect(response.cookies.get(LAST_SEEN_COOKIE)?.value).toMatch(/^\d+$/);
  });
});
