import { mkdirSync, rmSync } from "node:fs";
import { request } from "@playwright/test";
import { AUTH_DIR, BASE_URL, PASSWORD, TEMP, cleanLeftovers, emailOf, freshIp, pool, q, removeAccount, statePath, supabaseAdmin, tempId, type Login } from "./helpers";

/** Accounts that get a finished profile; "unverified" has no confirmed email. */
const PROFILED: (keyof typeof TEMP)[] = ["tester", "peer", "third", "leaver", "deleter", "suspended", "changer"];

async function ensureTempUser(key: keyof typeof TEMP) {
  const email = TEMP[key];
  const id = tempId(email);
  await removeAccount(id);
  const { error } = await supabaseAdmin.auth.admin.createUser({
    id,
    email,
    password: PASSWORD,
    email_confirm: key !== "unverified",
    user_metadata: { name: `E2E ${key}` },
  });
  if (error) throw new Error(`Could not create ${email}: ${error.message}`);
  if (!PROFILED.includes(key)) return;
  const name = `E2E ${key[0].toUpperCase()}${key.slice(1)}`;
  await q(
    `insert into "User" (id, email, name, "verificationMethod", batch, programme, department, semester, bio, "profileCompletedAt", "updatedAt")
     values ($1, $2, $3, 'EMAIL', 2023, 'BS Computer Science', 'Computer Science', 5, 'Account created for an automated test run.', now(), now())`,
    [id, email, name],
  );
  await q(`insert into "UserCourse" ("userId", "courseId") select $1, id from "Course" where code = 'CSE341'`, [id]);
}

export default async function globalSetup() {
  if (!BASE_URL || !PASSWORD) throw new Error("Set E2E_BASE_URL and DEMO_ACCOUNT_PASSWORD (in .env.local).");
  mkdirSync(AUTH_DIR, { recursive: true });
  rmSync(`${AUTH_DIR}/shared.json`, { force: true });

  // Clean start: no rate-limit counters, new account without a profile, fresh temp accounts
  await cleanLeftovers();
  for (const key of Object.keys(TEMP) as (keyof typeof TEMP)[]) await ensureTempUser(key);

  // Sign in once per account and keep the session for the tests
  const logins: Login[] = ["admin", "adviser", "student", "alumnus", "newbie", ...PROFILED];
  for (const who of logins) {
    const ctx = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    const res = await ctx.post("/api/v1/auth/sign-in", { data: { email: emailOf(who), password: PASSWORD } });
    if (!res.ok()) throw new Error(`Sign-in failed for ${who}: ${res.status()} ${await res.text()}`);
    await ctx.storageState({ path: statePath(who) });
    await ctx.dispose();
  }
  await pool.end();
}
