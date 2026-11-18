import { z } from "zod";
import { created, ok, route } from "@/lib/api/handler";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { INBOX_VIEWS, inboxCounts, listRequests, requestSchema, sendRequest } from "@/lib/services/connections";

/** GET /api/v1/connections?view=incoming|outgoing|accepted: the requests inbox (FR3.3, US3.4). */
export const GET = route(async (request) => {
  const member = await requireMember();
  const { view } = parseQuery(request, z.object({ view: z.enum(INBOX_VIEWS).default("incoming") }));
  const [items, counts] = await Promise.all([listRequests(member.id, view), inboxCounts(member.id)]);
  // The storage path of the photo is internal; the API returns the person's id and name only
  return ok({ view, counts, items: items.map((item) => ({ ...item, person: { id: item.person.id, name: item.person.name } })) });
});

/** POST /api/v1/connections {recipientId, note}: send a connection request (FR3.1, US3.1, US3.2). */
export const POST = route(async (request) => {
  const member = await requireMember();
  const input = await parseJson(request, requestSchema);
  const { connection, remaining } = await sendRequest(member, input);
  return created({ id: connection.id, status: connection.status, remainingToday: remaining });
});
