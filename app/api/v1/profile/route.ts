import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { getOwnProfile, saveProfile } from "@/lib/services/profile";
import { profileSchema } from "@/lib/validation/profile";

/** GET /api/v1/profile: the signed-in member's own profile. */
export const GET = route(async () => {
  const member = await requireMember({ profileComplete: false });
  return ok(await getOwnProfile(member.id));
});

/** PUT /api/v1/profile: create or update the member's profile (FR1.4, US1.5, US1.6). */
export const PUT = route(async (request) => {
  const member = await requireMember({ profileComplete: false });
  const input = await parseJson(request, profileSchema);
  await saveProfile(member, input);
  return ok(await getOwnProfile(member.id));
});
