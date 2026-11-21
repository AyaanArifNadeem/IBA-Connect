import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Record an administrator action (who, what, when, which item), FR8.4 / NFR18. */
export function recordAdminAction(
  adminId: string,
  action: string,
  target: { type: string; id: string },
  details?: Prisma.InputJsonValue,
  tx: Pick<Prisma.TransactionClient, "adminAction"> = db,
) {
  return tx.adminAction.create({
    data: { adminId, action, targetType: target.type, targetId: target.id, details },
  });
}
