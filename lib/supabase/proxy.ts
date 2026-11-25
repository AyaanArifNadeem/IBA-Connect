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
 * Route handlers under /api verify the session themselves (requireMember, NFR7). The auth endpoints
 * are left out: sign-in and friends must behave exactly as for a page request, so that a stale
 * cookie from an idle session never blocks signing in again.
 */
export function handlerVerifiesSession(pathname: string): boolean {
  return (pathname === "/api" || pathname.startsWith("/api/")) && !pathname.startsWith("/api/v1/auth/");
}

/**
 * Supabase stores the session in `sb-<project>-auth-token`, split into `.0`, `.1`... chunks when it
 * is large. A request without one cannot be signed in, so there is nothing to verify or refresh.
 * (The `-code-verifier` cookie used during OAuth is deliberately not matched.)
 */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));
}

/**
 * Refresh the Supabase session cookies for page requests, and send signed-out visitors
 * from member pages to the sign-in page. This is an optimistic check; pages and API
 * routes still verify the session and the member on the server.
 *
 * Auth work is skipped where it would be repeated or pointless:
 * - No session cookie: the visitor cannot be signed in, so no Supabase client is created.
 * - /api requests (not /api/v1/auth): the route handler verifies the token with the Auth server (getUser) and can set
 *   refreshed cookies itself, so a second Auth check here only added latency to every API call.
 *   The cookie is still used as a hint so idle expiry (FR1.6) keeps being enforced and renewed.
 *   Server Components cannot set cookies, which is why page requests keep the refresh here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  let signedIn = false;
  if (url && key && hasAuthCookie(request)) {
    if (handlerVerifiesSession(pathname)) {
      // Optimistic hint only: the route handler answers 401 when the token is not valid
      signedIn = true;
    } else {
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
  }

  const { search } = request.nextUrl;
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
