import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireAdmin } from "@/lib/auth/session";
import { endCode } from "@/lib/services/admin-alumni";

const schema = z.object({ action: z.enum(["expire", "revoke"]) });

/** PATCH /api/v1/admin/alumni-codes/{id} {action: "expire" | "revoke"} (FR1.9). */
export const PATCH = route<RouteContext<"/api/v1/admin/alumni-codes/[id]">>(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { action } = await parseJson(request, schema);
  const record = await endCode(admin.id, z.uuid().parse(id), action);
  return ok({ id: record.id, expiresAt: record.expiresAt, revokedAt: record.revokedAt });
});
