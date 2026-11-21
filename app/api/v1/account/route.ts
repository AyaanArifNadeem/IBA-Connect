import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/services/account";

/** The member must type DELETE to confirm (FR1.8, TC-036). */
const schema = z.object({ confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }) });

/** DELETE /api/v1/account {confirm: "DELETE"}: delete your account and anonymise your data (FR1.8). */
export const DELETE = route(async (request) => {
  const member = await requireMember({ profileComplete: false });
  await parseJson(request, schema);
  await deleteAccount(member.id);
  return ok({ deleted: true });
});
