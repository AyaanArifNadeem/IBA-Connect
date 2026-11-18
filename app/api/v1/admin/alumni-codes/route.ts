import { z } from "zod";
import { created, ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireAdmin } from "@/lib/auth/session";
import { createCode, listCodes } from "@/lib/services/admin-alumni";

/** GET /api/v1/admin/alumni-codes: all alumni codes with their status (FR1.9). */
export const GET = route(async () => {
  await requireAdmin();
  return ok(await listCodes());
});

const createSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).nullable(),
  note: z.string().trim().max(80).optional(),
});

/** POST /api/v1/admin/alumni-codes: issue a new code (FR1.9). */
export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const input = await parseJson(request, createSchema);
  const record = await createCode(admin.id, input);
  return created({ id: record.id, code: record.inviteCode, expiresAt: record.expiresAt });
});
