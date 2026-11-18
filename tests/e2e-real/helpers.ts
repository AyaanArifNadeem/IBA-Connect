/* eslint-disable @typescript-eslint/no-explicit-any -- API responses are read loosely in these end-to-end checks */
/**
 * Shared helpers for the real-backend tests (tests/e2e-real). These run against the team's
 * Supabase project through a running app (E2E_BASE_URL), never in CI.
 */
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

export const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD ?? "";
export const BASE_URL = process.env.E2E_BASE_URL ?? "";
export const AUTH_DIR = "test-results/.auth";

/** Direct SQL (the generated Prisma client is ESM-only and does not load in Playwright's CommonJS runner). */
export const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, max: 3 });
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[];
}
export async function count(text: string, params: unknown[] = []): Promise<number> {
  const rows = await q<{ n: string }>(`select count(*) as n from ${text}`, params);
  return Number(rows[0].n);
}
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The five demo logins (npm run db:demo). */
export const DEMO = {
  admin: "admin@khi.iba.edu.pk",
  adviser: "adviser@khi.iba.edu.pk",
  student: "student@khi.iba.edu.pk",
  alumnus: "alumnus@khi.iba.edu.pk",
  newbie: "newbie@khi.iba.edu.pk",
} as const;

/** Throwaway accounts created for one run and deleted afterwards. */
export const TEMP = {
  tester: "e2e.tester@khi.iba.edu.pk",
  peer: "e2e.peer@khi.iba.edu.pk",
  third: "e2e.third@khi.iba.edu.pk",
  leaver: "e2e.leaver@khi.iba.edu.pk",
  deleter: "e2e.deleter@khi.iba.edu.pk",
  suspended: "e2e.suspended@khi.iba.edu.pk",
  unverified: "e2e.unverified@khi.iba.edu.pk",
  changer: "e2e.changer@khi.iba.edu.pk",
} as const;

export type Login = keyof typeof DEMO | keyof typeof TEMP;
export const emailOf = (who: Login) => (DEMO as Record<string, string>)[who] ?? (TEMP as Record<string, string>)[who];
export const statePath = (who: Login) => `${AUTH_DIR}/${who}.json`;

/** A different client IP per call, so per-IP rate limits never mix between tests. */
export const freshIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

export const tempId = (email: string) => {
  const h = createHash("sha256").update(`iba-connect-e2e:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export async function memberByEmail(email: string) {
  const [m] = await q(`select * from "User" where email = $1`, [email]);
  if (!m) throw new Error(`No member ${email}`);
  return m;
}

/** Remove a test account from the app and from Supabase Auth. */
export async function removeAccount(id: string) {
  await q(`delete from "User" where id = $1`, [id]);
  await supabaseAdmin.auth.admin.deleteUser(id).catch(() => {});
}

/** Everything a run may leave behind, apart from the fixed temp accounts. */
export async function cleanLeftovers() {
  for (const { id } of await q<{ id: string }>(`select id::text from auth.users where email like 'e2e.%'`)) await removeAccount(id);
  await q(`delete from "AlumniRecord" where name = 'E2E run' or "personalEmail" like 'e2e.%'`);
  await q(`delete from "Post" where title like 'E2E %'`);
  await q(`delete from "Course" where code like 'ETE%'`);
  await q(`delete from "User" where email = $1`, [DEMO.newbie]);
  await q(`delete from "RateLimitHit"`);
}

export { randomUUID };
