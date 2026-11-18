import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { setAdvising } from "@/lib/services/advising";
import { getOwnProfile } from "@/lib/services/profile";

const schema = z.object({
  available: z.boolean(),
  courseIds: z.array(z.uuid()).max(40).default([]),
});

/** PUT /api/v1/profile/advising: turn "available to advise" on or off (FR1.5, US1.8). */
export const PUT = route(async (request) => {
  const member = await requireMember();
  const input = await parseJson(request, schema);
  await setAdvising(member.id, input.available, input.courseIds);
  const profile = await getOwnProfile(member.id);
  return ok({ availableToAdvise: profile.availableToAdvise, courses: profile.courses });
});
