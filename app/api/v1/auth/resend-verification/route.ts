import { ok, route } from "@/lib/api/handler";
import { clientIp, parseJson } from "@/lib/api/validation";
import { publicEnv } from "@/lib/env";
import { AUTH_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { emailOnlySchema } from "@/lib/validation/auth";

/** POST /api/v1/auth/resend-verification: send the verification email again (US1.2). */
export const POST = route(async (request) => {
  const input = await parseJson(request, emailOnlySchema);
  await enforceRateLimit({
    key: `auth:resend:${clientIp(request)}`,
    ...AUTH_LIMITS.register,
    message: "Too many emails requested. Please try again later.",
  });

  const supabase = await createClient();
  const { appUrl } = publicEnv();
  // The answer is the same whether or not the email is registered.
  await supabase.auth.resend({
    type: "signup",
    email: input.email,
    options: { emailRedirectTo: `${appUrl}/auth/confirm?next=/profile/setup` },
  });

  return ok({ message: "If that email is waiting for verification, a new link is on its way." });
});
