import { ApiError, emailNotVerified, suspended } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { clientIp, parseJson } from "@/lib/api/validation";
import { UserStatus, VerificationMethod } from "@/lib/generated/prisma/enums";
import { AUTH_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { ensureMember, landingPathFor } from "@/lib/services/members";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/auth";

/** POST /api/v1/auth/sign-in: email + password sign-in (FR1.2). Rate-limited per IP (NFR20). */
export const POST = route(async (request) => {
  await enforceRateLimit({
    key: `auth:sign-in:${clientIp(request)}`,
    ...AUTH_LIMITS.signIn,
    message: "Too many attempts. Please wait a few minutes and try again.",
  });

  const input = await parseJson(request, signInSchema);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") throw emailNotVerified();
    // Logged without the password (NFR18)
    console.warn("[auth] sign-in failed", { code: error?.code ?? "no_user" });
    throw new ApiError(401, "unauthorized", "Incorrect email or password.");
  }

  const member = await ensureMember({
    id: data.user.id,
    email: data.user.email ?? input.email,
    name: String(data.user.user_metadata?.name ?? ""),
    method: VerificationMethod.EMAIL,
  });

  if (member.status === UserStatus.SUSPENDED) {
    await supabase.auth.signOut();
    throw suspended();
  }

  return ok({ next: landingPathFor(member) });
});
