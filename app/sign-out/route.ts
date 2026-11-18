import { type NextRequest, NextResponse } from "next/server";
import { LAST_SEEN_COOKIE } from "@/lib/auth/idle";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["signed-out", "suspended", "idle"]);

/**
 * /sign-out?reason=... : end the session and go to the sign-in page (FR1.6).
 * Used by the account menu, and by the server for suspended or idle sessions.
 */
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "signed-out";
  const target = new URL("/sign-in", request.nextUrl.origin);
  target.searchParams.set("reason", REASONS.has(reason) ? reason : "signed-out");

  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.delete(LAST_SEEN_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = signOut;
export const POST = signOut;
