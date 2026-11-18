import "server-only";
import { db } from "@/lib/db";
import { AlumniRecordKind, Role, VerificationMethod } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

const usable = (now: Date): Prisma.AlumniRecordWhereInput => ({
  claimedById: null,
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

/**
 * Find the alumni record that would verify this person (FR1.3): an unclaimed, unexpired,
 * unrevoked code, or their personal email on the alumni list. Null means "not verified".
 */
export function findUsableRecord(input: { method: "code"; code: string } | { method: "list"; email: string }, now = new Date()) {
  return db.alumniRecord.findFirst({
    where:
      input.method === "code"
        ? { kind: AlumniRecordKind.CODE, inviteCode: input.code, ...usable(now) }
        : { kind: AlumniRecordKind.LIST_ENTRY, personalEmail: input.email.toLowerCase(), ...usable(now) },
  });
}

/**
 * Create the alumnus member and claim the record in one transaction. The claim only succeeds
 * if nobody claimed the record first, so a code can be used once even under concurrent use.
 */
export async function createVerifiedAlumnus(args: {
  userId: string;
  email: string;
  name: string;
  recordId: string;
  method: "code" | "list";
}) {
  return db.$transaction(async (tx) => {
    const member = await tx.user.create({
      data: {
        id: args.userId,
        email: args.email.toLowerCase(),
        personalEmail: args.email.toLowerCase(),
        name: args.name,
        role: Role.ALUMNUS,
        verificationMethod: args.method === "code" ? VerificationMethod.ALUMNI_CODE : VerificationMethod.ALUMNI_LIST,
      },
    });
    const claimed = await tx.alumniRecord.updateMany({
      where: { id: args.recordId, claimedById: null, revokedAt: null },
      data: { claimedById: member.id, claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("ALUMNI_RECORD_TAKEN");
    return member;
  });
}
