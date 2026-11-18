import "server-only";
import { notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { ConnectionStatus, Role } from "@/lib/generated/prisma/enums";
import { avatarUrl } from "@/lib/storage/avatars";
import { visibleMembers } from "./directory";

/** True when the two members have an accepted connection (FR3.5). */
export async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const found = await db.connection.findFirst({
    where: {
      status: ConnectionStatus.ACCEPTED,
      OR: [
        { requesterId: a, recipientId: b },
        { requesterId: b, recipientId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * A member's profile as another member sees it (FR2.1, US2.6). The email is included only
 * for accepted connections (FR3.5, NFR10) or when viewing your own profile.
 */
export async function getMemberProfile(viewerId: string, memberId: string) {
  const isSelf = viewerId === memberId;
  const member = await db.user.findFirst({
    where: isSelf ? { id: memberId, deletedAt: null } : { ...visibleMembers(viewerId), id: memberId },
    include: {
      skills: { include: { skill: true } },
      courses: { include: { course: true }, orderBy: { course: { code: "asc" } } },
    },
  });
  if (!member) throw notFound("This member could not be found.");

  const connected = isSelf ? false : await areConnected(viewerId, memberId);
  const isAlumnus = member.role === Role.ALUMNUS;

  return {
    id: member.id,
    name: member.name,
    isSelf,
    isAlumnus,
    avatarUrl: await avatarUrl(member.avatarPath),
    batch: member.batch,
    programme: member.programme,
    department: member.department,
    semester: isAlumnus ? null : member.semester,
    bio: member.bio ?? "",
    field: isAlumnus ? member.field : null,
    company: isAlumnus ? member.company : null,
    availableToAdvise: member.availableToAdvise,
    skills: member.skills.map((s) => s.skill.name).sort((a, b) => a.localeCompare(b)),
    courses: member.courses.map((c) => ({
      code: c.course.code,
      title: c.course.title,
      canAdvise: member.availableToAdvise && c.canAdvise,
    })),
    connected,
    email: isSelf || connected ? member.email : null,
  };
}

export type MemberProfile = Awaited<ReturnType<typeof getMemberProfile>>;
