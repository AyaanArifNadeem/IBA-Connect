import { ok, route } from "@/lib/api/handler";
import { clientIp, parseJson } from "@/lib/api/validation";
import { publicEnv } from "@/lib/env";
import { AUTH_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { emailOnlySchema } from "@/lib/validation/auth";

/**
 * POST /api/v1/auth/forgot-password: email a password reset link (US1.3).
 * Same answer whether or not the email is registered, so accounts cannot be discovered.
 */
export const POST = route(async (request) => {
  const input = await parseJson(request, emailOnlySchema);
  await enforceRateLimit({
    key: `auth:password-reset:${clientIp(request)}`,
    ...AUTH_LIMITS.passwordReset,
    message: "Too many reset requests. Please try again later.",
  });

  const supabase = await createClient();
  const { appUrl } = publicEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${appUrl}/auth/confirm?type=recovery`,
  });
  if (error) console.warn("[auth] password reset email failed", { code: error.code });

  return ok({ message: "If an account uses that email, a reset link is on its way." });
});
