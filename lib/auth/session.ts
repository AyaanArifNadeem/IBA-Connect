import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { assertAccess, type AccessOptions, type AuthIdentity } from "./access";

/**
 * The signed-in identity from Supabase Auth. Uses getUser(), which checks the token with the
 * auth server, rather than trusting the cookie alone. Cached for one request.
 */
export const getIdentity = cache(async (): Promise<AuthIdentity | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    emailVerified: Boolean(data.user.email_confirmed_at),
  };
});

/** The member row for the signed-in identity, or null. Cached for one request. */
export const getCurrentMember = cache(async () => {
  const identity = await getIdentity();
  if (!identity) return null;
  return db.user.findUnique({ where: { id: identity.id } });
});

/**
 * Server-side guard for route handlers and server actions (NFR7).
 * Returns the member, or throws an ApiError (401/403) that route() turns into JSON.
 */
export async function requireMember(options: AccessOptions = {}) {
  const identity = await getIdentity();
  const member = identity ? await getCurrentMember() : null;
  assertAccess(identity, member, options);
  return member!;
}

export const requireAdmin = () => requireMember({ admin: true, profileComplete: false });
