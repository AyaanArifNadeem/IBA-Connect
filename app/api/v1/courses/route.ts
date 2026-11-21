import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { listCourses } from "@/lib/services/profile";

/** GET /api/v1/courses?q=: active courses from the course list (FR1.10). */
export const GET = route(async (request) => {
  await requireMember({ profileComplete: false });
  const { q } = parseQuery(request, z.object({ q: z.string().max(60).optional() }));
  return ok(await listCourses(q));
});
