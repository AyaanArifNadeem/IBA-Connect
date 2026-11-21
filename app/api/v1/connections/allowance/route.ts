import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { requestAllowance } from "@/lib/services/connections";

/** GET /api/v1/connections/allowance: requests left in the last 24 hours (shown in the Connect pop-up). */
export const GET = route(async () => {
  const member = await requireMember();
  return ok(await requestAllowance(member.id));
});
