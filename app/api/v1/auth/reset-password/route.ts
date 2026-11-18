import { badRequest, unauthorized } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validation/auth";

/**
 * POST /api/v1/auth/reset-password: set a new password (US1.3).
 * Only works in the session opened by the reset link (/auth/confirm, type=recovery).
 * Afterwards every session is signed out, so the member signs in with the new password.
 */
export const POST = route(async (request) => {
  const input = await parseJson(request, resetPasswordSchema);
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) throw unauthorized("This reset link has expired. Please request a new one.");

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    if (error.code === "same_password") throw badRequest("Choose a password different from your old one.");
    if (error.code === "weak_password") throw badRequest(error.message);
    throw error;
  }

  await supabase.auth.signOut({ scope: "global" });
  return ok({ message: "Your password has been changed. Sign in with your new password." });
});
