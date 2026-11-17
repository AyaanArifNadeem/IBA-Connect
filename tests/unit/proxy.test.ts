import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
