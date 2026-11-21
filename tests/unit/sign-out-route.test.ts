import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));
const { GET } = await import("@/app/sign-out/route");

beforeEach(() => signOut.mockReset());

describe("/sign-out (FR1.6)", () => {
  it("TC-028: ends the session and goes to sign-in", async () => {
    const res = await GET(new NextRequest("http://localhost/sign-out"));
    expect(signOut).toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/sign-in?reason=signed-out");
    expect(res.headers.get("set-cookie")).toContain("iba_last_seen=;");
  });

  it("passes on a known reason and ignores anything else", async () => {
    const suspended = await GET(new NextRequest("http://localhost/sign-out?reason=suspended"));
    expect(suspended.headers.get("location")).toBe("http://localhost/sign-in?reason=suspended");
    const odd = await GET(new NextRequest("http://localhost/sign-out?reason=<script>"));
    expect(odd.headers.get("location")).toBe("http://localhost/sign-in?reason=signed-out");
  });
});
