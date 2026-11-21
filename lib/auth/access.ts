import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import type { User } from "@/lib/generated/prisma/client";
import {
  emailNotVerified,
  forbidden,
  profileIncomplete,
  suspended,
  unauthorized,
} from "@/lib/api/errors";
import { hasIbaDomain } from "@/lib/validation/auth";

export type AccessOptions = {
  /** Require a finished profile (most member features). Default true. */
  profileComplete?: boolean;
  /** Require the admin role (FR8.5). Default false. */
  admin?: boolean;
};

export type AuthIdentity = {
  id: string;
  email: string | null;
  emailVerified: boolean;
};

/**
 * Pure access decision used by requireMember(); kept separate so it can be unit tested.
 * Throws the matching ApiError when access is refused.
 */
export function assertAccess(
  identity: AuthIdentity | null,
  member: Pick<User, "id" | "role" | "status" | "profileCompletedAt" | "deletedAt"> | null,
  options: AccessOptions = {},
): void {
  const { profileComplete = true, admin = false } = options;

  if (!identity) throw unauthorized();
  if (!identity.emailVerified) throw emailNotVerified();
  if (!member || member.deletedAt) throw unauthorized("Your account was not found. Please sign in again.");
  if (member.status === UserStatus.SUSPENDED) throw suspended();
  if (member.status === UserStatus.DEACTIVATED) {
    throw unauthorized("This account is deactivated. Sign in again to reactivate it.");
  }
  if (admin && member.role !== Role.ADMIN) throw forbidden();
  if (profileComplete && !member.profileCompletedAt) throw profileIncomplete();
}

/** True when the email belongs to the IBA domain (exact domain, case-insensitive). */
export function isIbaEmail(email: string, domain: string): boolean {
  return hasIbaDomain(email, domain);
}
