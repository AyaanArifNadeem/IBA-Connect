import "server-only";
import { conflict } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { ConnectionStatus, PostStatus, UserStatus } from "@/lib/generated/prisma/enums";
import { deleteAvatar } from "@/lib/storage/avatars";
import { createAdminClient } from "@/lib/supabase/server";

/** Deactivate (FR1.8): the profile leaves the directory at once; signing in again reactivates it. */
export async function deactivateAccount(memberId: string) {
  const member = await db.user.findUniqueOrThrow({ where: { id: memberId } });
  if (member.deletedAt) throw conflict("This account has been deleted.");
  await db.user.update({ where: { id: memberId }, data: { status: UserStatus.DEACTIVATED } });
}

/** Signing in again brings a deactivated account back. Suspended and deleted accounts stay as they are. */
export async function reactivateIfDeactivated<T extends { id: string; status: UserStatus; deletedAt: Date | null }>(member: T): Promise<T> {
  if (member.status !== UserStatus.DEACTIVATED || member.deletedAt) return member;
  await db.user.update({ where: { id: member.id }, data: { status: UserStatus.ACTIVE } });
  return { ...member, status: UserStatus.ACTIVE };
}

/**
 * Delete (FR1.8, SRS 6.5). The profile is removed from the directory and its personal data
 * anonymised; messages stay for the other person but show "Deleted member"; pending requests
 * are declined and open posts closed; the Supabase sign-in account is removed so the person can
 * no longer sign in. Records kept for audit (admin actions, claimed alumni codes) stay.
 */
export async function deleteAccount(memberId: string, now = new Date()) {
  const member = await db.user.findUniqueOrThrow({ where: { id: memberId } });
  if (member.deletedAt) return;

  await db.$transaction([
    db.userSkill.deleteMany({ where: { userId: memberId } }),
    db.userCourse.deleteMany({ where: { userId: memberId } }),
    db.block.deleteMany({ where: { OR: [{ blockerId: memberId }, { blockedId: memberId }] } }),
    db.connection.updateMany({
      where: { status: ConnectionStatus.PENDING, OR: [{ requesterId: memberId }, { recipientId: memberId }] },
      data: { status: ConnectionStatus.DECLINED, respondedAt: now },
    }),
    db.post.updateMany({ where: { authorId: memberId, status: PostStatus.OPEN }, data: { status: PostStatus.CLOSED, closedAt: now } }),
    db.rateLimitHit.deleteMany({ where: { userId: memberId } }),
    db.user.update({
      where: { id: memberId },
      data: {
        name: "Deleted member",
        email: `deleted-${memberId}@deleted.invalid`,
        personalEmail: null,
        avatarPath: null,
        bio: null,
        batch: null,
        programme: null,
        department: null,
        semester: null,
        field: null,
        company: null,
        availableToAdvise: false,
        status: UserStatus.DEACTIVATED,
        deletedAt: now,
      },
    }),
  ]);

  if (member.avatarPath) await deleteAvatar(member.avatarPath);
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(memberId);
    if (error) throw error;
  } catch (err) {
    // The member record is already anonymised and refused at sign-in (deletedAt); log for follow-up
    console.error("[account] could not remove the sign-in account", { reason: err instanceof Error ? err.message : "unknown" });
  }
}
