import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { created, ok, route } from "@/lib/api/handler";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { listMessages, messageSchema, sendMessage } from "@/lib/services/messages";

type Ctx = RouteContext<"/api/v1/connections/[id]/messages">;

async function connectionId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("Conversation not found.");
  return id;
}

/** GET /api/v1/connections/{id}/messages?after=ISO: messages in order; `after` for polling (FR3.4, FR3.8). */
export const GET = route<Ctx>(async (request, ctx) => {
  const member = await requireMember();
  const id = await connectionId(ctx);
  const { after } = parseQuery(request, z.object({ after: z.iso.datetime().optional() }));
  return ok(await listMessages(member.id, id, after ? new Date(after) : undefined));
});

/** POST /api/v1/connections/{id}/messages {body}: send a text message (FR3.4, FR3.8). */
export const POST = route<Ctx>(async (request, ctx) => {
  const member = await requireMember();
  const id = await connectionId(ctx);
  const { body } = await parseJson(request, messageSchema);
  return created(await sendMessage(member.id, id, body));
});
