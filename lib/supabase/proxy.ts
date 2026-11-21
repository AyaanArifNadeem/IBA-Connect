import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { LAST_SEEN_COOKIE, idleLimitMs, isIdleExpired, shouldTouch } from "@/lib/auth/idle";

/** Pages that need a signed-in member. API routes check access themselves (NFR7). */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/directory",
  "/members",
  "/requests",
  "/messages",
  "/board",
  "/settings",
  "/profile",
  "/admin",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refresh the Supabase session cookies on every request, and send signed-out visitors
 * from member pages to the sign-in page. This is an optimistic check; pages and API
 * routes still verify the session and the member on the server.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let signedIn = false;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Do not add code between creating the client and this call (session refresh).
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  const { pathname, search } = request.nextUrl;
  if (!signedIn && isProtectedPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(signIn);
  }
  // Signed-in members skip the landing page
  if (signedIn && pathname === "/") {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
  }

  // Idle sessions expire (FR1.6): sign out when the last request is older than the limit
  if (signedIn && pathname !== "/sign-out") {
    const now = Date.now();
    const lastSeen = request.cookies.get(LAST_SEEN_COOKIE)?.value;
    if (isIdleExpired(lastSeen, now)) {
      const signOut = request.nextUrl.clone();
      signOut.pathname = "/sign-out";
      signOut.search = "?reason=idle";
      return NextResponse.redirect(signOut);
    }
    if (shouldTouch(lastSeen, now)) {
      response.cookies.set(LAST_SEEN_COOKIE, String(now), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.ceil(idleLimitMs() / 1000),
      });
    }
  }
  return response;
}
