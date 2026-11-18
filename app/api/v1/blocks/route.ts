import { z } from "zod";
import { created, ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { blockMember, listBlocked } from "@/lib/services/blocks";

/** GET /api/v1/blocks: members you blocked (FR3.7). */
export const GET = route(async () => {
  const member = await requireMember();
  return ok(await listBlocked(member.id));
});

/** POST /api/v1/blocks {memberId}: block a member (FR3.7). */
export const POST = route(async (request) => {
  const member = await requireMember();
  const { memberId } = await parseJson(request, z.object({ memberId: z.uuid() }));
  await blockMember(member.id, memberId);
  return created({ blocked: memberId });
});
