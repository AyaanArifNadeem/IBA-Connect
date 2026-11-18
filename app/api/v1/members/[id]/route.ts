import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { getMemberProfile } from "@/lib/services/member-profile";

/** GET /api/v1/members/{id}: a member's profile; email only for accepted connections (US2.6, FR3.5). */
export const GET = route<RouteContext<"/api/v1/members/[id]">>(async (_request, ctx) => {
  const viewer = await requireMember();
  const { id } = await ctx.params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw notFound("This member could not be found.");
  return ok(await getMemberProfile(viewer.id, parsed.data));
});
