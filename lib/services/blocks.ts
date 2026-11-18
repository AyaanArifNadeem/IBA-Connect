import "server-only";
import { badRequest, notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";

/**
 * Block a member (FR3.7). They can no longer send you requests or messages, nor you to them.
 * Pending requests between you are closed so they leave both inboxes. Blocking twice is harmless.
 */
export async function blockMember(blockerId: string, blockedId: string, now = new Date()) {
  if (blockerId === blockedId) throw badRequest("You cannot block yourself.");
  const target = await db.user.findFirst({ where: { id: blockedId, deletedAt: null }, select: { id: true } });
  if (!target) throw notFound("This member could not be found.");

  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId, createdAt: now },
    }),
    db.connection.updateMany({
      where: {
        status: ConnectionStatus.PENDING,
        OR: [
          { requesterId: blockerId, recipientId: blockedId },
          { requesterId: blockedId, recipientId: blockerId },
        ],
      },
      data: { status: ConnectionStatus.DECLINED, respondedAt: now },
    }),
  ]);
}

export async function unblockMember(blockerId: string, blockedId: string) {
  await db.block.deleteMany({ where: { blockerId, blockedId } });
}

export async function isBlockedByMe(blockerId: string, blockedId: string) {
  return Boolean(await db.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } }));
}

/** Members you blocked (Settings). */
export async function listBlocked(blockerId: string) {
  const rows = await db.block.findMany({
    where: { blockerId },
    include: { blocked: { select: { id: true, name: true, deletedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((b) => ({
    id: b.blocked.id,
    name: b.blocked.deletedAt ? "Deleted member" : b.blocked.name,
    since: b.createdAt.toISOString(),
  }));
}
