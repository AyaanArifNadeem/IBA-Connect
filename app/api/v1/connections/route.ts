import { created, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { requestSchema, sendRequest } from "@/lib/services/connections";

/** POST /api/v1/connections {recipientId, note}: send a connection request (FR3.1, US3.1, US3.2). */
export const POST = route(async (request) => {
  const member = await requireMember();
  const input = await parseJson(request, requestSchema);
  const { connection, remaining } = await sendRequest(member, input);
  return created({ id: connection.id, status: connection.status, remainingToday: remaining });
});
