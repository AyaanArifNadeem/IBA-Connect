import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, VerificationMethod, type Prisma } from "@/lib/generated/prisma/client";

export const testDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

/** Empty every application table (keeps the migration history). */
export async function resetDatabase() {
  const tables = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Create a member with a completed profile; override any field. */
export async function makeUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  const id = overrides.id ?? randomUUID();
  return testDb.user.create({
    data: {
      id,
      email: `${id.slice(0, 8)}@member.test`,
      name: "Test Member",
      verificationMethod: VerificationMethod.EMAIL,
      batch: 2024,
      programme: "BS Computer Science",
      department: "Computer Science",
      semester: 5,
      bio: "Test bio",
      profileCompletedAt: new Date(),
      ...overrides,
    },
  });
}
