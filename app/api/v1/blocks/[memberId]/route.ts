import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { noContent, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { unblockMember } from "@/lib/services/blocks";

/** DELETE /api/v1/blocks/{memberId}: unblock a member (FR3.7). */
export const DELETE = route<RouteContext<"/api/v1/blocks/[memberId]">>(async (_request, ctx) => {
  const member = await requireMember();
  const { memberId } = await ctx.params;
  if (!z.uuid().safeParse(memberId).success) throw notFound("This member could not be found.");
  await unblockMember(member.id, memberId);
  return noContent();
});
