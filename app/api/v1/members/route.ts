import { ok, route } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { directoryQuerySchema, listMembers } from "@/lib/services/directory";

/** GET /api/v1/members?page=: the member directory (FR2.1). No contact details. */
export const GET = route(async (request) => {
  const member = await requireMember();
  const query = parseQuery(request, directoryQuerySchema);
  return ok(await listMembers(member.id, query));
});
