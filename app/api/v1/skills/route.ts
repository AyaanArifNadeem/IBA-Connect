import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { suggestSkills } from "@/lib/services/profile";

/** GET /api/v1/skills?q=: skill suggestions from the shared list. */
export const GET = route(async (request) => {
  await requireMember({ profileComplete: false });
  const { q } = parseQuery(request, z.object({ q: z.string().max(40).optional() }));
  const skills = await suggestSkills(q);
  return ok(skills.map((s) => s.name));
});
