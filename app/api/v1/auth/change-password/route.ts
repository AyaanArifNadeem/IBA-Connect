import { badRequest } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validation/auth";

/** POST /api/v1/auth/change-password: signed-in member changes their password (US1.3). */
export const POST = route(async (request) => {
  const member = await requireMember({ profileComplete: false });
  const input = await parseJson(request, changePasswordSchema);
  await enforceRateLimit({
    key: `auth:change-password:${member.id}`,
    limit: 5,
    windowMs: 60 * 60_000,
    userId: member.id,
    message: "Too many attempts. Please try again later.",
  });

  const supabase = await createClient();

  // Confirm the current password before changing it
  const check = await supabase.auth.signInWithPassword({ email: member.email, password: input.currentPassword });
  if (check.error) throw badRequest("Your current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) {
    if (error.code === "same_password") throw badRequest("Choose a password different from your current one.");
    if (error.code === "weak_password") throw badRequest(error.message);
    throw error;
  }

  // Sign out other devices; this session stays signed in
  await supabase.auth.signOut({ scope: "others" });
  return ok({ message: "Password changed." });
});
