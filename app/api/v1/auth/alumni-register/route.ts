import { ApiError, rateLimited } from "@/lib/api/errors";
import { created, route } from "@/lib/api/handler";
import { clientIp, parseJson } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { ibaEmailDomain, publicEnv } from "@/lib/env";
import { AUTH_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { createVerifiedAlumnus, findUsableRecord } from "@/lib/services/alumni";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { alumniRegisterSchema } from "@/lib/validation/alumni";

const NOT_VERIFIED =
  "We could not verify you as an alumnus. Check the code, or ask the IBA Connect team to add your email to the alumni list.";

/**
 * POST /api/v1/auth/alumni-register: alumni sign-up with a personal email (FR1.3, US1.4).
 * The code or alumni-list entry is checked first; no account is created unless it is valid.
 */
export const POST = route(async (request) => {
  const input = await parseJson(request, alumniRegisterSchema(ibaEmailDomain()));
  // Counts every attempt, so codes cannot be guessed by trying many
  await enforceRateLimit({
    key: `auth:alumni:${clientIp(request)}`,
    ...AUTH_LIMITS.alumniVerify,
    message: "Too many verification attempts. Please try again later.",
  });

  const record = await findUsableRecord(
    input.method === "code" ? { method: "code", code: input.code } : { method: "list", email: input.email },
  );
  if (!record) throw new ApiError(400, "bad_request", NOT_VERIFIED);

  if (await db.user.findFirst({ where: { OR: [{ email: input.email }, { personalEmail: input.email }] } })) {
    throw new ApiError(409, "conflict", "An account already uses this email. Sign in or reset your password.");
  }

  const supabase = await createClient();
  const { appUrl } = publicEnv();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name }, emailRedirectTo: `${appUrl}/auth/confirm?next=/profile/setup` },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      throw rateLimited("Too many emails sent. Please wait a few minutes and try again.", 300);
    }
    throw error;
  }
  // Supabase returns a user without identities when the email is already registered
  if (!data.user || data.user.identities?.length === 0) {
    throw new ApiError(409, "conflict", "An account already uses this email. Sign in or reset your password.");
  }

  try {
    await createVerifiedAlumnus({ userId: data.user.id, email: input.email, name: input.name, recordId: record.id, method: input.method });
  } catch (err) {
    // Someone claimed the record at the same moment: undo the new auth account
    await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (err instanceof Error && err.message === "ALUMNI_RECORD_TAKEN") throw new ApiError(400, "bad_request", NOT_VERIFIED);
    throw err;
  }

  return created({ message: "You are verified as an alumnus. Check your email to confirm your address, then sign in." });
});
