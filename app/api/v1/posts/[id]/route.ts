import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { editPost, postEditSchema } from "@/lib/services/posts";

/** PATCH /api/v1/posts/{id} {title, body, course?, department?}: edit your own open post (FR4.5). */
export const PATCH = route<RouteContext<"/api/v1/posts/[id]">>(async (request, ctx) => {
  const member = await requireMember();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("This post could not be found.");
  const input = await parseJson(request, postEditSchema);
  const post = await editPost(member.id, id, input);
  return ok({ id: post.id, title: post.title });
});
