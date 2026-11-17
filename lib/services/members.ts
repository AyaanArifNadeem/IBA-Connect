import "server-only";
import { db } from "@/lib/db";
import { Role, VerificationMethod } from "@/lib/generated/prisma/enums";

export type NewMemberIdentity = {
  /** Supabase Auth user id */
  id: string;
  email: string;
  name: string;
  method: VerificationMethod;
};

/**
 * Return the member for this auth account, creating it on first sign-in.
 * Safe to call on every sign-in: an existing member is returned unchanged.
 */
export async function ensureMember(identity: NewMemberIdentity) {
  const existing = await db.user.findUnique({ where: { id: identity.id } });
  if (existing) return existing;

  const role = identity.method === VerificationMethod.ALUMNI_CODE || identity.method === VerificationMethod.ALUMNI_LIST
    ? Role.ALUMNUS
    : Role.STUDENT;

  return db.user.upsert({
    where: { id: identity.id },
    update: {},
    create: {
      id: identity.id,
      email: identity.email.toLowerCase(),
      name: identity.name.trim() || identity.email.split("@")[0],
      role,
      verificationMethod: identity.method,
    },
  });
}

/** Where to send a member after sign-in: profile setup until it is finished (US1.1, US1.5). */
export function landingPathFor(member: { profileCompletedAt: Date | null }): string {
  return member.profileCompletedAt ? "/dashboard" : "/profile/setup";
}
