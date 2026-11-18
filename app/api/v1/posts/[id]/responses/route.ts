import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { created, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { respondToPost, responseSchema } from "@/lib/services/posts";

/** POST /api/v1/posts/{id}/responses {message}: respond to a post; opens a connection request (FR4.3, US4.3). */
export const POST = route<RouteContext<"/api/v1/posts/[id]/responses">>(async (request, ctx) => {
  const member = await requireMember();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("This post could not be found.");
  const { message } = await parseJson(request, responseSchema);
  const { response, connection, remaining } = await respondToPost(member, id, message);
  return created({ id: response.id, connectionId: connection.id, remainingToday: remaining });
});
