import { badRequest, rateLimited } from "@/lib/api/errors";
import { created, route } from "@/lib/api/handler";
import { clientIp, parseJson } from "@/lib/api/validation";
import { ibaEmailDomain, publicEnv } from "@/lib/env";
import { AUTH_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validation/auth";

/**
 * POST /api/v1/auth/register: email + password registration for IBA emails (FR1.2, US1.2).
 * Supabase Auth stores the password as a bcrypt hash and sends the verification email.
 * The member record is created once the email is verified (see /auth/confirm).
 */
export const POST = route(async (request) => {
  // Invalid input is rejected first and does not count towards the limit
  const input = await parseJson(request, registerSchema(ibaEmailDomain()));
  await enforceRateLimit({
    key: `auth:register:${clientIp(request)}`,
    ...AUTH_LIMITS.register,
    message: "Too many registration attempts. Please try again later.",
  });

  const supabase = await createClient();
  const { appUrl } = publicEnv();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name },
      emailRedirectTo: `${appUrl}/auth/confirm?next=/profile/setup`,
    },
  });

  if (error) {
    if (error.code === "weak_password") throw badRequest(error.message);
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      throw rateLimited("Too many emails sent. Please wait a few minutes and try again.", 300);
    }
    // An existing email gets the same answer as a new one, so accounts cannot be discovered.
    if (error.code !== "user_already_exists" && error.code !== "email_exists") throw error;
  }

  return created({
    message: "Check your email for a verification link. Already registered? Sign in or reset your password.",
  });
});
