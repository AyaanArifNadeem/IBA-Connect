import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { deactivateAccount } from "@/lib/services/account";

/** POST /api/v1/account/deactivate: hide your profile until you sign in again (FR1.8). The client then signs out. */
export const POST = route(async () => {
  const member = await requireMember({ profileComplete: false });
  await deactivateAccount(member.id);
  return ok({ status: "DEACTIVATED" });
});
