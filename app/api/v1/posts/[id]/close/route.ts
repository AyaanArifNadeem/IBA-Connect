import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { closePost } from "@/lib/services/posts";

/** POST /api/v1/posts/{id}/close: close your post early (FR4.4, US4.4). */
export const POST = route<RouteContext<"/api/v1/posts/[id]/close">>(async (_request, ctx) => {
  const member = await requireMember();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("This post could not be found.");
  const post = await closePost(member.id, id);
  return ok({ id: post.id, status: post.status, closedAt: post.closedAt });
});
