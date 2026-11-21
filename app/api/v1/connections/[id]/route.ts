import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { respondToRequest } from "@/lib/services/connections";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

/** PATCH /api/v1/connections/{id} {action}: accept or decline a request (FR3.2, US3.3). */
export const PATCH = route<RouteContext<"/api/v1/connections/[id]">>(async (request, ctx) => {
  const member = await requireMember();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("Request not found.");
  const { action } = await parseJson(request, schema);
  const connection = await respondToRequest(member.id, id, action);
  return ok({ id: connection.id, status: connection.status });
});
