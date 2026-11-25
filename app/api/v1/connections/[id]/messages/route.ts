import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { created, ok, route } from "@/lib/api/handler";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { hasUnreadIncoming, listMessages, markRead, messageSchema, sendMessage } from "@/lib/services/messages";

type Ctx = RouteContext<"/api/v1/connections/[id]/messages">;

async function connectionId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("Conversation not found.");
  return id;
}

/** GET /api/v1/connections/{id}/messages?after=ISO: messages in order, marked as read; `after` for polling (FR3.4, FR3.8, US3.6). */
export const GET = route<Ctx>(async (request, ctx) => {
  const member = await requireMember();
  const id = await connectionId(ctx);
  const { after } = parseQuery(request, z.object({ after: z.iso.datetime().optional() }));
  const messages = await listMessages(member.id, id, after ? new Date(after) : undefined);
  // Reading the chat marks the other member's messages as read (US3.6). An empty poll (the common
  // case) has nothing to mark, so it makes no write; loading the whole chat always marks it.
  if (!after || hasUnreadIncoming(messages)) await markRead(member.id, id);
  return ok(messages);
});

/** POST /api/v1/connections/{id}/messages {body}: send a text message (FR3.4, FR3.8). */
export const POST = route<Ctx>(async (request, ctx) => {
  const member = await requireMember();
  const id = await connectionId(ctx);
  const { body } = await parseJson(request, messageSchema);
  return created(await sendMessage(member.id, id, body));
});
