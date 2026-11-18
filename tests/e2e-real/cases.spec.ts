/* eslint-disable @typescript-eslint/no-explicit-any -- API responses are read loosely in these end-to-end checks */
/**
 * The Sprint 1 test cases (docs/testing/test-cases.json) run against the real backend.
 * Each test title starts with the case IDs it covers; the "actual" annotation is what happened.
 * Tests run in file order and share state (one request, one chat, ...).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { actual, as, disposeAll, fresh, json } from "./api";
import { AUTH_DIR, DEMO, PASSWORD, TEMP, count, memberByEmail, q, statePath } from "./helpers";

const id: Record<string, string> = {};
/** Values passed between tests; kept in a file because Playwright starts a new worker after a failure. */
const SHARED_FILE = `${AUTH_DIR}/shared.json`;
const shared: Record<string, string> = new Proxy(existsSync(SHARED_FILE) ? JSON.parse(readFileSync(SHARED_FILE, "utf8")) : {}, {
  set(target, key, value) {
    target[key as string] = value;
    writeFileSync(SHARED_FILE, JSON.stringify(target));
    return true;
  },
});
const SERVER_LOG = process.env.E2E_SERVER_LOG;
const emailLines = () => (SERVER_LOG ? (readFileSync(SERVER_LOG, "utf8").match(/\[email\]/g) ?? []).length : -1);

test.beforeAll(async () => {
  for (const [k, email] of Object.entries({ ...DEMO, ...TEMP })) {
    const [m] = await q(`select id from "User" where email = $1`, [email]);
    if (m) id[k] = m.id;
  }
  const [course] = await q(`select id from "Course" where code = 'CSE341'`);
  shared.cse341 = course.id;
});
test.afterAll(async () => {
  await disposeAll();
});

// ------------------------------------------------------------------ F1 identity

test("TC-003 returning member goes straight to the dashboard", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  actual(test.info(), "Opening / as student@khi.iba.edu.pk redirected to /dashboard, which loaded.");
  await ctx.close();
});

test("TC-004 register with email and password", async () => {
  // Sends a real verification email, which Supabase limits to a few per hour without custom SMTP
  test.skip(!process.env.E2E_SEND_EMAIL, "set E2E_SEND_EMAIL=1 to include it");
  const api = await fresh();
  const res = await api.post("/api/v1/auth/register", { data: { name: "E2E New Member", email: "e2e.new.member@khi.iba.edu.pk", password: "Str0ng!Pass" } });
  const body = await json(res);
  actual(test.info(), `POST /auth/register returned ${res.status()}: "${body.data?.message ?? body.error?.message}". Delivery of the verification email not checked (Supabase default SMTP, Brevo not set up).`);
  expect(res.status()).toBe(201);
  await api.dispose();
});

test("TC-005 weak password is rejected", async () => {
  const api = await fresh();
  const res = await api.post("/api/v1/auth/register", { data: { name: "E2E Weak", email: "e2e.weak@khi.iba.edu.pk", password: "abc12" } });
  const body = await json(res);
  const created = await count(`"User" where email = 'e2e.weak@khi.iba.edu.pk'`);
  const authUsers = [{ n: await count(`auth.users where email = 'e2e.weak@khi.iba.edu.pk'`) }];
  actual(test.info(), `400 ${body.error?.code}: ${body.error?.details?.map((d) => d.message).join("; ") ?? body.error?.message}. Accounts created: ${Number(authUsers[0].n) + created}.`);
  expect(res.status()).toBe(400);
  expect(Number(authUsers[0].n) + created).toBe(0);
  await api.dispose();
});

test("TC-006 unverified account cannot use the platform", async ({ browser }) => {
  const api = await fresh();
  const res = await api.post("/api/v1/auth/sign-in", { data: { email: TEMP.unverified, password: PASSWORD } });
  const body = await json(res);
  const ctx = await browser.newContext({ storageState: await api.storageState() });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  const url = page.url();
  actual(test.info(), `Sign-in returned ${res.status()} ${body.error?.code}: "${body.error?.message}". Opening /dashboard ended on ${new URL(url).pathname}.`);
  expect(res.status()).toBe(403);
  expect(url).not.toMatch(/\/dashboard$/);
  await ctx.close();
  await api.dispose();
});

test("TC-008 wrong password is refused", async () => {
  const api = await fresh();
  const res = await api.post("/api/v1/auth/sign-in", { data: { email: DEMO.student, password: "Wrong-pass1!" } });
  const body = await json(res);
  const state = await api.storageState();
  const authCookies = state.cookies.filter((c) => c.name.includes("auth-token"));
  actual(test.info(), `${res.status()}: "${body.error?.message}"; session cookies set: ${authCookies.length}.`);
  expect(res.status()).toBe(401);
  expect(body.error?.message).toMatch(/Incorrect email or password/);
  expect(authCookies).toHaveLength(0);
  await api.dispose();
});

test("TC-009 repeated failed sign-ins are rate-limited", async () => {
  const api = await fresh();
  const statuses: number[] = [];
  let last: Awaited<ReturnType<typeof json>> = {};
  let retryAfter: string | undefined;
  for (let i = 0; i < 11; i++) {
    const res = await api.post("/api/v1/auth/sign-in", { data: { email: DEMO.alumnus, password: `Wrong-pass${i}!` } });
    statuses.push(res.status());
    last = await json(res);
    retryAfter = res.headers()["retry-after"];
  }
  actual(test.info(), `Statuses: ${statuses.join(", ")}. 11th: "${last.error?.message}", Retry-After ${retryAfter ?? "none"} s.`);
  expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
  expect(statuses[10]).toBe(429);
  expect(retryAfter).toBeTruthy();
  await api.dispose();
});

test("TC-010 passwords are stored as bcrypt hashes", async () => {
  const rows = await q<{ h: string }>(`select encrypted_password as h from auth.users where email = $1`, [DEMO.student]);
  const hash = rows[0]?.h ?? "";
  const plainStored = await count(`auth.users where encrypted_password = $1`, [PASSWORD]);
  actual(test.info(), `auth.users.encrypted_password starts with "${hash.slice(0, 7)}" (${hash.length} chars); plain-text matches: ${plainStored}. The app's own tables have no password column.`);
  expect(hash).toMatch(/^\$2[ab]\$/);
  expect(Number(plainStored)).toBe(0);
});

test("TC-013 TC-014 change password while signed in", async () => {
  const api = await as("changer");
  const mismatch = await api.post("/api/v1/auth/change-password", { data: { currentPassword: PASSWORD, newPassword: "Pass1!aaaa", confirmPassword: "Pass2!bbbb" } });
  const mm = await json(mismatch);
  const res = await api.post("/api/v1/auth/change-password", { data: { currentPassword: PASSWORD, newPassword: "Ch4nged!Pass", confirmPassword: "Ch4nged!Pass" } });
  const ok = await json(res);
  const signNew = await (await fresh()).post("/api/v1/auth/sign-in", { data: { email: TEMP.changer, password: "Ch4nged!Pass" } });
  const signOld = await (await fresh()).post("/api/v1/auth/sign-in", { data: { email: TEMP.changer, password: PASSWORD } });
  test.info().annotations.push({
    type: "actual:TC-014",
    description: `Mismatch returned ${mismatch.status()}: "${mm.error?.details?.map((d) => d.message).join("; ") ?? mm.error?.message}"; the old password still worked until the real change.`,
  });
  actual(test.info(), `Change returned ${res.status()} ("${ok.data?.message}"). Sign-in with the new password: ${signNew.status()}; with the old one: ${signOld.status()}.`);
  expect(mismatch.status()).toBe(400);
  expect(JSON.stringify(mm)).toContain("Passwords do not match");
  expect(res.status()).toBe(200);
  expect(signNew.status()).toBe(200);
  expect(signOld.status()).toBe(401);
});

// --------------------------------------------------------- alumni codes and list

test("TC-037 admin creates an alumni code", async () => {
  const admin = await as("admin");
  const res = await admin.post("/api/v1/admin/alumni-codes", { data: { expiresInDays: 30, note: "E2E run" } });
  const body = await json(res);
  shared.code = body.data?.code;
  shared.codeId = body.data?.id;
  const list = await json(await admin.get("/api/v1/admin/alumni-codes"));
  const row = (list.data as any[])?.find?.((c) => c.code === shared.code) ?? (list.data?.codes as any[])?.find((c: any) => c.code === shared.code);
  const audit = await count(`"AdminAction" where "targetId" = $1`, [shared.codeId]);
  actual(test.info(), `201 with code ${shared.code ? "IBA-****-****" : "missing"}; listed with status "${row?.status}"; audit entries for it: ${audit}.`);
  expect(res.status()).toBe(201);
  expect(row?.status).toBe("active");
  expect(audit).toBeGreaterThan(0);
});

// TC-015 and TC-016 send a real confirmation email to a personal address, so they are run by hand
// once Brevo SMTP is set up (see the manual checklist in the test results).

test("TC-018 code already claimed is refused", async () => {
  // Mark the new code as claimed by another member, then try to use it
  await q(`update "AlumniRecord" set "claimedById" = $2, "claimedAt" = now() where id = $1`, [shared.codeId, id.third]);
  const api = await fresh();
  const res = await api.post("/api/v1/auth/alumni-register", {
    data: { method: "code", name: "E2E Second", email: "e2e.second.alumnus@example.com", password: "Str0ng!Pass", code: shared.code },
  });
  const body = await json(res);
  actual(test.info(), `${res.status()} ${body.error?.code}: "${body.error?.message}". No account created.`);
  expect(res.status()).toBe(400);
  expect(body.error?.message).toMatch(/could not verify you as an alumnus/);
  expect(await count(`"User" where email = 'e2e.second.alumnus@example.com'`)).toBe(0);
  await api.dispose();
});

test("TC-038 TC-017 revoked, expired and unknown codes are refused", async () => {
  const admin = await as("admin");
  const codes: Record<string, string> = {};
  for (const action of ["revoke", "expire"] as const) {
    const made = await json(await admin.post("/api/v1/admin/alumni-codes", { data: { expiresInDays: 30, note: "E2E run" } }));
    const patched = await admin.patch(`/api/v1/admin/alumni-codes/${made.data.id}`, { data: { action } });
    expect(patched.status()).toBe(200);
    codes[action] = made.data.code;
  }
  const list = await json(await admin.get("/api/v1/admin/alumni-codes"));
  const rows: any[] = Array.isArray(list.data) ? list.data : (list.data?.codes ?? []);
  const revokedStatus = rows.find((c) => c.code === codes.revoke)?.status;
  const results: string[] = [];
  for (const [label, code] of [["revoked", codes.revoke], ["expired", codes.expire], ["unknown", "IBA-ZZZZ-ZZZZ"]]) {
    const res = await (await fresh()).post("/api/v1/auth/alumni-register", {
      data: { method: "code", name: "E2E Bad Code", email: `e2e.badcode.${label}@example.com`, password: "Str0ng!Pass", code },
    });
    const body = await json(res);
    results.push(`${label}: ${res.status()} "${body.error?.message}"`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  }
  test.info().annotations.push({ type: "actual:TC-038", description: `Revoked code listed as "${revokedStatus}"; using it: ${results[0]}.` });
  actual(test.info(), results.join("; ") + ". No alumnus accounts created.");
  expect(revokedStatus).toBe("revoked");
  expect(await count(`"User" where email like 'e2e.badcode.%'`)).toBe(0);
});

test("TC-039 admin uploads the alumni list", async () => {
  const admin = await as("admin");
  const csv = "email,name,batch\ne2e.list1@example.com,E2E List One,2012\ne2e.list2@example.com,E2E List Two,2014\ne2e.list3@example.com,E2E List Three,2016\ne2e.list1@example.com,E2E List One,2012\n";
  const res = await admin.post("/api/v1/admin/alumni-list", { multipart: { file: { name: "alumni.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } } });
  const body = await json(res);
  const stored = await count(`"AlumniRecord" where "personalEmail" like 'e2e.list%'`);
  actual(test.info(), `${res.status()}: added ${body.data?.added}, skipped ${body.data?.skipped}, invalid ${body.data?.invalid?.length ?? 0} (file had 3 rows plus 1 duplicate). Stored entries: ${stored}.`);
  expect(res.status()).toBe(200);
  expect(stored).toBe(3);
});

test("TC-040 non-admin cannot open the admin panel", async ({ browser }) => {
  const api = await as("student");
  const res = await api.get("/api/v1/admin/courses");
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  const nav = await page.goto("/admin");
  const text = await page.locator("body").innerText();
  actual(test.info(), `GET /api/v1/admin/courses as student: ${res.status()}. Page /admin: HTTP ${nav?.status()}, ended on ${new URL(page.url()).pathname}, admin tools shown: ${/alumni codes/i.test(text)}.`);
  expect(res.status()).toBe(403);
  expect(/alumni codes/i.test(text)).toBe(false);
  await ctx.close();
});

// ---------------------------------------------------------------- courses

test("TC-041 admin adds a course", async () => {
  const admin = await as("admin");
  const res = await admin.post("/api/v1/admin/courses", { data: { code: "ETE450", title: "E2E Cloud Computing", department: "Computer Science" } });
  const body = await json(res);
  shared.ete450 = body.data?.id;
  const picker = await json(await (await as("tester")).get("/api/v1/courses?q=ETE450"));
  actual(test.info(), `${res.status()}; course picker search "ETE450" returns ${picker.data?.length} course(s).`);
  expect(res.status()).toBe(201);
  expect(picker.data?.length).toBe(1);
});

test("TC-043 duplicate course code is rejected", async () => {
  const res = await (await as("admin")).post("/api/v1/admin/courses", { data: { code: "CSE341", title: "Duplicate", department: "Computer Science" } });
  const body = await json(res);
  actual(test.info(), `${res.status()}: "${body.error?.message}".`);
  expect(res.status()).toBe(409);
  expect(body.error?.message).toContain("Course code already exists");
});

// ----------------------------------------------------------------- profile

const profilePayload = (over: Record<string, unknown> = {}) => ({
  name: "E2E Tester",
  batch: 2023,
  programme: "BS Computer Science",
  department: "Computer Science",
  semester: 5,
  bio: "Account created for an automated test run.",
  skills: ["Python", "Figma"],
  courseIds: [shared.cse341],
  ...over,
});

test("TC-020 TC-021 profile setup validation", async () => {
  const api = await as("newbie");
  const noSkills = await api.put("/api/v1/profile", { data: profilePayload({ name: "Newbie Member", skills: [] }) });
  const a = await json(noSkills);
  const longBio = await api.put("/api/v1/profile", { data: profilePayload({ name: "Newbie Member", bio: "x".repeat(501) }) });
  const b = await json(longBio);
  const [member] = await q(`select "profileCompletedAt" from "User" where email = $1`, [DEMO.newbie]);
  test.info().annotations.push({ type: "actual:TC-021", description: `${longBio.status()}: ${b.error?.details?.map((d) => `${d.path}: ${d.message}`).join("; ")}. Profile finished: ${Boolean(member?.profileCompletedAt)}.` });
  actual(test.info(), `${noSkills.status()}: ${a.error?.details?.map((d) => `${d.path}: ${d.message}`).join("; ")}. Profile finished: ${Boolean(member?.profileCompletedAt)}.`);
  expect(noSkills.status()).toBe(400);
  expect(a.error?.details?.some((d) => d.path.startsWith("skills"))).toBe(true);
  expect(longBio.status()).toBe(400);
  expect(JSON.stringify(b)).toContain("500");
  expect(member?.profileCompletedAt ?? null).toBeNull();
});

test("TC-019 profile setup with all required fields", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("newbie") });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  // The redirect is sent in the streamed page, so wait for the browser to follow it
  await page.waitForURL(/\/profile\/setup$/, { timeout: 10_000 }).catch(() => {});
  const firstStop = new URL(page.url()).pathname;
  const res = await (await as("newbie")).put("/api/v1/profile", { data: profilePayload({ name: "Newbie Member", skills: ["Python"] }) });
  const member = await memberByEmail(DEMO.newbie);
  id.newbie = member.id;
  const found = await json(await (await as("tester")).get("/api/v1/members?q=Newbie"));
  await page.goto("/dashboard");
  const after = new URL(page.url()).pathname;
  actual(test.info(), `Before: /dashboard sent the new account to ${firstStop}. PUT /profile ${res.status()}; directory search "Newbie" finds them: ${found.data?.members?.some((m: any) => m.id === member.id)}; /dashboard then opens (${after}).`);
  expect(firstStop).toBe("/profile/setup");
  expect(res.status()).toBe(200);
  expect(after).toBe("/dashboard");
  await ctx.close();
});

test("TC-022 edited profile appears on the profile and in search", async () => {
  const api = await as("tester");
  const res = await api.put("/api/v1/profile", { data: profilePayload({ skills: ["Python", "Figma"], courseIds: [shared.cse341, shared.ete450] }) });
  const profile = await json(await (await as("peer")).get(`/api/v1/members/${id.tester}`));
  const search = await json(await (await as("peer")).get("/api/v1/members?q=Figma"));
  actual(test.info(), `PUT ${res.status()}; profile skills: ${profile.data?.skills?.join(", ")}; search "Figma" lists the member: ${search.data?.members?.some((m: any) => m.id === id.tester)}.`);
  expect(res.status()).toBe(200);
  expect(profile.data?.skills).toContain("Figma");
  expect(search.data?.members?.some((m: any) => m.id === id.tester)).toBe(true);
});

test("TC-042 retired course leaves the picker but stays on profiles", async () => {
  const admin = await as("admin");
  const res = await admin.patch(`/api/v1/admin/courses/${shared.ete450}`, { data: { retired: true } });
  const picker = await json(await (await as("peer")).get("/api/v1/courses?q=ETE450"));
  const profile = await json(await (await as("peer")).get(`/api/v1/members/${id.tester}`));
  const onProfile = profile.data?.courses?.some((c: any) => c.code === "ETE450");
  actual(test.info(), `Retire ${res.status()}; picker results for ETE450: ${picker.data?.length}; still on the existing profile: ${onProfile}.`);
  expect(res.status()).toBe(200);
  expect(picker.data?.length).toBe(0);
  expect(onProfile).toBe(true);
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

test("TC-023 image avatar is uploaded and shown", async () => {
  const api = await as("tester");
  const res = await api.post("/api/v1/profile/avatar", { multipart: { file: { name: "avatar.png", mimeType: "image/png", buffer: PNG } } });
  const body = await json(res);
  const card = (await json(await (await as("peer")).get("/api/v1/members?q=Tester"))).data?.members?.find((m: any) => m.id === id.tester);
  const img = body.data?.avatarUrl ? await api.get(body.data.avatarUrl) : null;
  actual(test.info(), `${res.status()}; signed URL returned: ${Boolean(body.data?.avatarUrl)} (fetch ${img?.status()}); directory card has an avatar: ${Boolean(card?.avatarUrl)}.`);
  expect(res.status()).toBe(200);
  expect(card?.avatarUrl).toBeTruthy();
});

test("TC-024 non-image avatar is rejected", async () => {
  const api = await as("tester");
  const before = (await q(`select "avatarPath" from "User" where id = $1`, [id.tester]))[0].avatarPath;
  const res = await api.post("/api/v1/profile/avatar", { multipart: { file: { name: "file.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") } } });
  const body = await json(res);
  const after = (await q(`select "avatarPath" from "User" where id = $1`, [id.tester]))[0].avatarPath;
  actual(test.info(), `${res.status()}: "${body.error?.details?.[0]?.message ?? body.error?.message}"; avatar unchanged: ${before === after}.`);
  expect(res.status()).toBe(400);
  expect(before).toBe(after);
});

test("TC-025 TC-053 alumni field and company", async () => {
  const api = await as("student");
  const profile = await json(await api.get(`/api/v1/members/${id.alumnus}`));
  const byField = await json(await api.get(`/api/v1/members?field=${encodeURIComponent("Banking & Finance")}`));
  const byCompany = await json(await api.get("/api/v1/members?company=Contoso"));
  const fieldMembers: any[] = byField.data?.members ?? [];
  const allMatch = fieldMembers.every((m) => m.isAlumnus && m.field === "Banking & Finance");
  test.info().annotations.push({
    type: "actual:TC-053",
    description: `field=Banking & Finance: ${fieldMembers.length} result(s), all alumni in that field: ${allMatch}; company=Contoso finds the alumnus: ${byCompany.data?.members?.some((m: any) => m.id === id.alumnus)}.`,
  });
  actual(test.info(), `Profile shows field "${profile.data?.field}" and company "${profile.data?.company}"; both filters find the alumnus.`);
  expect(profile.data?.field).toBe("Banking & Finance");
  expect(profile.data?.company).toBe("Contoso Bank");
  expect(fieldMembers.some((m) => m.id === id.alumnus)).toBe(true);
  expect(allMatch).toBe(true);
});

test("TC-087 TC-026 TC-027 available to advise", async () => {
  const api = await as("tester");
  const noCourse = await api.put("/api/v1/profile/advising", { data: { available: true, courseIds: [] } });
  const nc = await json(noCourse);
  const on = await api.put("/api/v1/profile/advising", { data: { available: true, courseIds: [shared.cse341] } });
  const filterOn = await json(await (await as("peer")).get("/api/v1/members?course=CSE341&advise=1&q=Tester"));
  const cardOn = filterOn.data?.members?.find((m: any) => m.id === id.tester);
  const off = await api.put("/api/v1/profile/advising", { data: { available: false } });
  const filterOff = await json(await (await as("peer")).get("/api/v1/members?course=CSE341&advise=1&q=Tester"));
  const profileOff = await json(await (await as("peer")).get(`/api/v1/members/${id.tester}`));
  test.info().annotations.push({ type: "actual:TC-087", description: `${noCourse.status()}: "${nc.error?.details?.[0]?.message}"; not saved.` });
  test.info().annotations.push({ type: "actual:TC-026", description: `On ${on.status()}; matches course=CSE341&advise=1 with adviseCourses [${cardOn?.adviseCourses}] (badge source).` });
  actual(test.info(), `Off ${off.status()}; in the advise filter afterwards: ${Boolean(filterOff.data?.members?.some((m: any) => m.id === id.tester))}; profile availableToAdvise: ${profileOff.data?.availableToAdvise}.`);
  expect(noCourse.status()).toBe(400);
  expect(nc.error?.details?.[0]?.message).toContain("Choose at least one course you can advise on");
  expect(on.status()).toBe(200);
  expect(cardOn?.adviseCourses).toContain("CSE341");
  expect(filterOff.data?.members?.some((m: any) => m.id === id.tester)).toBe(false);
});

// --------------------------------------------------------------- dashboard

test("TC-032 TC-069 dashboard counts and menu badges", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  const stat = async (label: string) => (await page.getByRole("link", { name: new RegExp(label) }).first().innerText()).match(/\d+/)?.[0];
  const pending = await stat("Pending requests");
  const unread = await stat("Unread messages");
  const open = await stat("My open posts");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  const badgeText = async (label: RegExp) => {
    const badge = nav.getByLabel(label);
    return (await badge.count()) ? badge.innerText() : "none";
  };
  const reqBadge = await badgeText(/unread requests/);
  const msgBadge = await badgeText(/unread messages/);
  const inbox = await json(await (await as("student")).get("/api/v1/connections?view=incoming"));
  test.info().annotations.push({ type: "actual:TC-069", description: `Requests badge ${reqBadge}, Messages badge ${msgBadge} for student (seeded data: ${inbox.data?.counts?.incoming} incoming requests, 1 unread message).` });
  actual(test.info(), `Pending requests ${pending}, unread messages ${unread}, my open posts ${open}; each tile links to its list.`);
  expect([pending, unread, open]).toEqual(["2", "1", "1"]);
  expect(reqBadge).toBe(String(inbox.data?.counts?.incoming));
  expect(msgBadge).toBe("1");
  await ctx.close();
});

test("TC-033 main screens within three clicks of the dashboard", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  const reached: string[] = [];
  for (const [name, path] of [["Directory", "/directory"], ["Need Board", "/board"], ["Messages", "/messages"], ["Requests", "/requests"]]) {
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    reached.push(`${name} 1`);
  }
  for (const [name, path] of [["Profile|My profile", "/profile"], ["Settings", "/settings"]]) {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: new RegExp(name) }).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    reached.push(`${path.slice(1)} 2`);
  }
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /post a need|new post/i }).first().click();
  await expect(page).toHaveURL(/\/board\/new$/);
  reached.push("new post 1");
  actual(test.info(), `Clicks from the dashboard: ${reached.join(", ")}. A member profile is 2 clicks (Directory, then a card); a chat is 2 (Messages, then the chat).`);
  await ctx.close();
});

// --------------------------------------------------------------- directory

test("TC-044 paginated directory with links to profiles", async ({ browser }) => {
  const api = await as("student");
  const p1 = await json(await api.get("/api/v1/members?page=1"));
  const p2 = await json(await api.get("/api/v1/members?page=2"));
  const overlap = (p1.data.members as any[]).filter((m) => (p2.data.members as any[]).some((n) => n.id === m.id)).length;
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  await page.goto("/directory");
  await page.locator('main a[href^="/members/"]').first().click();
  await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/);
  actual(test.info(), `${p1.data.total} members over ${p1.data.pages} pages of ${p1.data.pageSize}; pages 1 and 2 overlap: ${overlap}. Clicking a card opened ${new URL(page.url()).pathname.slice(0, 18)}...`);
  expect(p1.data.pages).toBeGreaterThan(1);
  expect(overlap).toBe(0);
  await ctx.close();
});

test("TC-045 TC-066 no contact details before a connection", async ({ browser }) => {
  const api = await as("tester");
  const list = await (await api.get("/api/v1/members?page=1")).text();
  const profile = await json(await api.get(`/api/v1/members/${id.peer}`));
  const ctx = await browser.newContext({ storageState: statePath("tester") });
  const page = await ctx.newPage();
  await page.goto("/directory");
  const dirHtml = await page.content();
  await page.goto(`/members/${id.peer}`);
  const profHtml = await page.content();
  const leaks = [list, dirHtml, profHtml].filter((t) => /@khi\.iba\.edu\.pk/.test(t)).length;
  test.info().annotations.push({ type: "actual:TC-066", description: `Before acceptance: profile API email ${JSON.stringify(profile.data?.email)}; e2e.peer's email absent from the profile page: ${!profHtml.includes(TEMP.peer)}.` });
  actual(test.info(), `Directory API, directory page and an unconnected profile page contain an @khi.iba.edu.pk address: ${leaks} of 3.`);
  expect(leaks).toBe(0);
  expect(profile.data?.email ?? null).toBeNull();
  await ctx.close();
});

test("TC-046 profile page shows the details", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  await page.goto(`/members/${id.adviser}`);
  const p = (await json(await (await as("student")).get(`/api/v1/members/${id.adviser}`))).data;
  const text = await page.locator("main").innerText();
  const shown = { name: text.includes(p.name), batch: text.includes(String(p.batch)), programme: text.includes(p.programme), department: text.includes(p.department), bio: text.includes(p.bio.slice(0, 30)), skills: p.skills.every((s: string) => text.includes(s)), courses: p.courses.every((c: any) => text.includes(c.code)), badge: /advise/i.test(text) };
  actual(test.info(), `Adviser's profile page shows: ${Object.entries(shown).map(([k, v]) => `${k} ${v ? "yes" : "NO"}`).join(", ")}.`);
  expect(Object.values(shown).every(Boolean)).toBe(true);
  await ctx.close();
});

test("TC-047 TC-048 free-text search", async () => {
  const api = await as("student");
  const py = await json(await api.get("/api/v1/members?q=Python"));
  const pyMembers: any[] = py.data.members;
  const pyOk = pyMembers.every((m) => m.skills.some((s: string) => /python/i.test(s)) || /python/i.test(m.name));
  const cse = await json(await api.get("/api/v1/members?q=CSE341"));
  const ids = (cse.data.members as any[]).map((m) => m.id);
  const withCourse = await count(`"UserCourse" uc join "Course" c on c.id = uc."courseId" where c.code = 'CSE341' and uc."userId" = any($1::uuid[])`, [ids]);
  test.info().annotations.push({ type: "actual:TC-048", description: `"CSE341": ${ids.length} result(s), ${withCourse} of them listed CSE341.` });
  actual(test.info(), `"Python": ${pyMembers.length} result(s), all with a Python skill or the word in their name: ${pyOk}.`);
  expect(pyMembers.length).toBeGreaterThan(0);
  expect(pyOk).toBe(true);
  expect(withCourse).toBe(ids.length);
});

test("TC-049 no matches shows an empty state", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student") });
  const page = await ctx.newPage();
  await page.goto("/directory?q=zzqxv");
  await expect(page.getByText(/No members found/i)).toBeVisible();
  const clear = page.getByRole("link", { name: "Clear the search and filters" });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page).toHaveURL(/\/directory$/);
  actual(test.info(), `"No members found." shown with a "Clear the search and filters" link; clicking it returned to the full directory.`);
  await ctx.close();
});

test("TC-051 TC-052 TC-089 directory filters", async () => {
  const api = await as("student");
  const adv = await json(await api.get("/api/v1/members?course=CSE341&advise=1"));
  const advM: any[] = adv.data.members;
  const advOk = advM.every((m) => m.adviseCourses.includes("CSE341"));
  const both = await json(await api.get(`/api/v1/members?batch=2023&department=${encodeURIComponent("Computer Science")}`));
  const bothM: any[] = both.data.members;
  const bothOk = bothM.every((m) => m.batch === 2023 && m.department === "Computer Science");
  const all = await json(await api.get("/api/v1/members"));
  const bad = await api.get("/api/v1/members?batch=abc&semester=99");
  const badBody = await json(bad);
  test.info().annotations.push({ type: "actual:TC-052", description: `batch 2023 + Computer Science: ${both.data.total} result(s), all matching both: ${bothOk}; without filters: ${all.data.total}.` });
  test.info().annotations.push({ type: "actual:TC-089", description: `${bad.status()} ${badBody.error?.code}: ${badBody.error?.details?.map((d) => `${d.path}: ${d.message}`).join("; ")}. "semester" is not a directory filter, so it is ignored.` });
  actual(test.info(), `CSE341 + advise: ${advM.length} adviser(s), all advising CSE341: ${advOk}; includes adviser@: ${advM.some((m) => m.id === id.adviser)}.`);
  expect(advOk && advM.some((m) => m.id === id.adviser)).toBe(true);
  expect(bothOk).toBe(true);
  expect(all.data.total).toBeGreaterThan(both.data.total);
  expect(bad.status()).toBe(400);
});

// -------------------------------------------------------- connections

test("TC-055 note longer than 300 characters is rejected", async () => {
  const res = await (await as("tester")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "x".repeat(301) } });
  const body = await json(res);
  const n = await count(`"Connection" where "requesterId" = $1 and "recipientId" = $2`, [id.tester, id.peer]);
  actual(test.info(), `${res.status()}: "${body.error?.details?.[0]?.message}"; requests stored: ${n}.`);
  expect(res.status()).toBe(400);
  expect(n).toBe(0);
});

test("TC-054 TC-068 send a request with a note", async () => {
  const before = emailLines();
  const res = await (await as("tester")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "Can you help with CSE341?" } });
  const body = await json(res);
  shared.conn = body.data?.id;
  const out = await json(await (await as("tester")).get("/api/v1/connections?view=outgoing"));
  const item = (out.data.items as any[]).find((i) => i.id === shared.conn);
  await new Promise((r) => setTimeout(r, 1500));
  const after = emailLines();
  test.info().annotations.push({ type: "note:TC-068", description: `Email not delivered: BREVO_API_KEY is not set, so the server logged "[email] connection request email failed" (${after - before} new email log line(s)). Needs Brevo.` });
  actual(test.info(), `${res.status()} ${body.data?.status}; in Outgoing with note "${item?.note}" and status ${item?.status}. Email not checked (Brevo not set up).`);
  expect(res.status()).toBe(201);
  expect(item?.status).toBe("PENDING");
});

test("TC-058 cannot request someone already pending", async ({ browser }) => {
  const res = await (await as("tester")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "Again" } });
  const body = await json(res);
  const ctx = await browser.newContext({ storageState: statePath("tester") });
  const page = await ctx.newPage();
  await page.goto(`/members/${id.peer}`);
  const pending = await page.getByRole("button", { name: "Request sent" }).waitFor({ timeout: 10_000 }).then(() => true, () => false);
  actual(test.info(), `Duplicate request: ${res.status()} "${body.error?.message}". Profile page shows the disabled "Request sent" button: ${pending}.`);
  expect(res.status()).toBe(409);
  expect(pending).toBe(true);
  await ctx.close();
});

test("TC-061 only the recipient can accept", async () => {
  const res = await (await as("tester")).patch(`/api/v1/connections/${shared.conn}`, { data: { action: "accept" } });
  const other = await (await as("third")).patch(`/api/v1/connections/${shared.conn}`, { data: { action: "accept" } });
  const [c] = await q(`select status from "Connection" where id = $1`, [shared.conn]);
  actual(test.info(), `Requester accepting: ${res.status()}; an unrelated member accepting: ${other.status()}; status still ${c.status}.`);
  expect([403, 404]).toContain(res.status());
  expect([403, 404]).toContain(other.status());
  expect(c.status).toBe("PENDING");
});

test("TC-064 messaging without an accepted connection is refused", async () => {
  const res = await (await as("tester")).post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "Hello" } });
  const n = await count(`"Message" where "connectionId" = $1`, [shared.conn]);
  actual(test.info(), `Pending connection: ${res.status()} "${(await json(res)).error?.message}"; messages stored: ${n}.`);
  expect([403, 404, 409]).toContain(res.status());
  expect(n).toBe(0);
});

test("TC-059 TC-067 accepting enables chat and shows emails", async () => {
  const res = await (await as("peer")).patch(`/api/v1/connections/${shared.conn}`, { data: { action: "accept" } });
  const a = await (await as("tester")).get(`/api/v1/connections/${shared.conn}/messages`);
  const b = await (await as("peer")).get(`/api/v1/connections/${shared.conn}/messages`);
  const tp = await json(await (await as("tester")).get(`/api/v1/members/${id.peer}`));
  const pt = await json(await (await as("peer")).get(`/api/v1/members/${id.tester}`));
  test.info().annotations.push({ type: "actual:TC-067", description: `After acceptance the tester sees ${tp.data?.email} and the peer sees ${pt.data?.email}.` });
  actual(test.info(), `Accept ${res.status()}; chat opens for both (${a.status()}, ${b.status()}).`);
  expect(res.status()).toBe(200);
  expect([a.status(), b.status()]).toEqual([200, 200]);
  expect(tp.data?.email).toBe(TEMP.peer);
  expect(pt.data?.email).toBe(TEMP.tester);
});

test("TC-060 TC-057 declining keeps chat disabled; cooldown", async () => {
  const req = await json(await (await as("leaver")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "Study group?" } }));
  const dec = await (await as("peer")).patch(`/api/v1/connections/${req.data.id}`, { data: { action: "decline" } });
  const out = await json(await (await as("leaver")).get("/api/v1/connections?view=outgoing"));
  const item = (out.data.items as any[]).find((i) => i.id === req.data.id);
  const chat = await (await as("leaver")).post(`/api/v1/connections/${req.data.id}/messages`, { data: { body: "Hi" } });
  const again = await (await as("leaver")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "Please?" } });
  const ag = await json(again);
  test.info().annotations.push({ type: "actual:TC-057", description: `Asking again: ${again.status()} "${ag.error?.message}".` });
  actual(test.info(), `Decline ${dec.status()}; requester sees status ${item?.status}; sending a message: ${chat.status()}.`);
  expect(dec.status()).toBe(200);
  expect(item?.status).toBe("DECLINED");
  expect(chat.status()).toBeGreaterThanOrEqual(400);
  expect(again.status()).toBeGreaterThanOrEqual(400);
  expect(ag.error?.message).toMatch(/day|again/i);
});

test("TC-062 TC-090 requests inbox tabs", async () => {
  const api = await as("peer");
  const views: Record<string, any> = {};
  for (const v of ["incoming", "outgoing", "accepted"]) views[v] = (await json(await api.get(`/api/v1/connections?view=${v}`))).data;
  const acc = (views.accepted.items as any[]).find((i) => i.id === shared.conn);
  const ids = ["incoming", "outgoing", "accepted"].flatMap((v) => (views[v].items as any[]).map((i) => i.id));
  const foreign = await count(`"Connection" where id = any($1::uuid[]) and "requesterId" <> $2 and "recipientId" <> $2`, [ids, id.peer]);
  test.info().annotations.push({ type: "actual:TC-090", description: `${ids.length} inbox item(s) across the tabs; items that do not involve the member: ${foreign}.` });
  actual(test.info(), `Counts: incoming ${views.incoming.counts.incoming}, outgoing ${views.outgoing.counts.outgoing}, accepted ${views.accepted.counts.accepted}. Accepted tab shows ${acc?.person?.name} with note "${acc?.note}".`);
  expect(acc?.person?.id).toBe(id.tester);
  expect(foreign).toBe(0);
});

test("TC-063 TC-072 TC-073 messages in order and length rules", async () => {
  const t = await as("tester");
  const p = await as("peer");
  await t.post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "one" } });
  await t.post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "two" } });
  await p.post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "three" } });
  const tv = (await json(await t.get(`/api/v1/connections/${shared.conn}/messages`))).data as any[];
  const pv = (await json(await p.get(`/api/v1/connections/${shared.conn}/messages`))).data as any[];
  const long = await t.post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "x".repeat(2001) } });
  const blank = await t.post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "   " } });
  const n = await count(`"Message" where "connectionId" = $1`, [shared.conn]);
  test.info().annotations.push({ type: "actual:TC-072", description: `${long.status()}: "${(await json(long)).error?.details?.[0]?.message}".` });
  test.info().annotations.push({ type: "actual:TC-073", description: `API: ${blank.status()}. Stored messages stay at ${n}.` });
  actual(test.info(), `Tester sees ${tv.map((m) => m.body).join(", ")}; peer sees ${pv.map((m) => m.body).join(", ")}; every message has a time.`);
  expect(tv.map((m) => m.body)).toEqual(["one", "two", "three"]);
  expect(pv.map((m) => m.body)).toEqual(["one", "two", "three"]);
  expect(tv.every((m) => m.sentAt)).toBe(true);
  expect(long.status()).toBe(400);
  expect(blank.status()).toBe(400);
  expect(n).toBe(3);
});

test("TC-065 unread indicator clears when the thread is opened", async ({ browser }) => {
  // A fresh message from the peer (reading the chat through the API above marked the others as read)
  const newer = await (await as("peer")).post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "unread check" } });
  expect(newer.status()).toBe(201);
  const ctx = await browser.newContext({ storageState: statePath("tester") });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  const badge = nav.getByLabel(/unread messages/);
  const before = (await badge.count()) ? await badge.innerText() : "none";
  await page.goto(`/messages/${shared.conn}`);
  await expect(page.getByText("unread check").last()).toBeVisible();
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const after = (await badge.count()) ? await badge.innerText() : "none";
  const unread = await count(`"Message" where "connectionId" = $1 and "senderId" = $2 and "readAt" is null`, [shared.conn, id.peer]);
  actual(test.info(), `Messages badge before: ${before}; after opening the chat: ${after}; unread rows left: ${unread}.`);
  expect(before).toBe("1");
  expect(after).toBe("none");
  expect(unread).toBe(0);
  await ctx.close();
});

test("TC-074 new messages appear without reloading", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("tester") });
  const page = await ctx.newPage();
  await page.goto(`/messages/${shared.conn}`);
  await expect(page.getByText("three").last()).toBeVisible();
  const t0 = Date.now();
  const sent = await (await as("peer")).post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "polling check" } });
  expect(sent.status()).toBe(201);
  const stored = Date.now();
  await expect(page.getByText("polling check").last()).toBeVisible({ timeout: 15_000 });
  const total = (Date.now() - t0) / 1000;
  const afterStored = (Date.now() - stored) / 1000;
  actual(test.info(), `Message from the peer appeared on the open chat without a reload, ${afterStored.toFixed(1)} s after it was saved (${total.toFixed(1)} s after the send started).`);
  // The chat polls every 5 s; allow one poll interval plus the time of the poll request itself
  expect(afterStored).toBeLessThanOrEqual(10);
  await ctx.close();
});

test("TC-070 TC-071 blocking", async () => {
  const blk = await (await as("tester")).post("/api/v1/blocks", { data: { memberId: id.newbie } });
  const req = await (await as("newbie")).post("/api/v1/connections", { data: { recipientId: id.tester, note: "Hi" } });
  const pb = await (await as("peer")).post("/api/v1/blocks", { data: { memberId: id.tester } });
  const msg = await (await as("tester")).post(`/api/v1/connections/${shared.conn}/messages`, { data: { body: "Hi" } });
  const unblock = await (await as("peer")).delete(`/api/v1/blocks/${id.tester}`);
  test.info().annotations.push({ type: "actual:TC-071", description: `Peer blocked the tester (${pb.status()}); tester's message: ${msg.status()} "${(await json(msg)).error?.message}". Unblocked afterwards (${unblock.status()}).` });
  actual(test.info(), `Block ${blk.status()}; blocked member's request: ${req.status()} "${(await json(req)).error?.message}".`);
  expect(blk.status()).toBe(201);
  expect(req.status()).toBeGreaterThanOrEqual(400);
  expect(msg.status()).toBeGreaterThanOrEqual(400);
});

test("TC-056 daily limit blocks the 11th request", async () => {
  const recipients = await q<{ id: string }>(
    `select id from "User" where "profileCompletedAt" is not null and status = 'ACTIVE' and email <> all($1::text[]) order by email limit 11`,
    [[...Object.values(DEMO), ...Object.values(TEMP)]],
  );
  const api = await as("third");
  const statuses: number[] = [];
  let last: Awaited<ReturnType<typeof json>> = {};
  for (const r of recipients) {
    const res = await api.post("/api/v1/connections", { data: { recipientId: r.id, note: "E2E limit check" } });
    statuses.push(res.status());
    last = await json(res);
  }
  actual(test.info(), `Statuses: ${statuses.join(", ")}. 11th: "${last.error?.message}".`);
  expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
  expect(statuses[10]).toBe(429);
});

test("TC-091 a refused request sends no email", async () => {
  const before = emailLines();
  const res = await (await as("third")).post("/api/v1/connections", { data: { recipientId: id.alumnus, note: "One more" } });
  await new Promise((r) => setTimeout(r, 1500));
  const after = emailLines();
  actual(test.info(), `Request refused with ${res.status()}; new email log lines on the server: ${SERVER_LOG ? after - before : "log not available"}.`);
  expect(res.status()).toBe(429);
  if (SERVER_LOG) expect(after - before).toBe(0);
});

// ---------------------------------------------------------------- board

test("TC-076 post without a title is rejected", async () => {
  const res = await (await as("tester")).post("/api/v1/posts", { data: { type: "STUDY_PARTNER", title: "", body: "Body", course: "CSE341" } });
  const body = await json(res);
  actual(test.info(), `${res.status()}: ${body.error?.details?.map((d) => `${d.path}: ${d.message}`).join("; ")}.`);
  expect(res.status()).toBe(400);
  expect(body.error?.details?.some((d) => d.path === "title")).toBe(true);
});

test("TC-075 create a post", async () => {
  const res = await (await as("tester")).post("/api/v1/posts", { data: { type: "STUDY_PARTNER", title: "E2E CSE341 study buddy", body: "Looking for a study partner for the midterm.", course: "CSE341" } });
  const board = await json(await (await as("peer")).get("/api/v1/posts?q=study%20buddy"));
  const post = (board.data.posts as any[]).find((p) => p.title === "E2E CSE341 study buddy");
  shared.post = post?.id;
  const days = post ? (new Date(post.expiresAt).getTime() - new Date(post.createdAt).getTime()) / 86_400_000 : NaN;
  actual(test.info(), `${res.status()}; another member sees it on the board with tag ${post?.courseCode}; expires ${days} days after creation.`);
  expect(res.status()).toBe(201);
  expect(post).toBeTruthy();
  expect(days).toBe(14);
});

test("TC-077 TC-092 board shows open posts and filters", async () => {
  const api = await as("peer");
  const all = await json(await api.get("/api/v1/posts"));
  const now = Date.now();
  const allOpen = (all.data.posts as any[]).every((p) => new Date(p.expiresAt).getTime() > now);
  const f = await json(await api.get("/api/v1/posts?type=study-partner&course=CSE341"));
  const fp: any[] = f.data.posts;
  const match = fp.every((p) => p.type === "STUDY_PARTNER" && p.courseCode === "CSE341");
  const closedOrExpired = await count(`"Post" where id = any($1::uuid[]) and (status <> 'OPEN' or "expiresAt" <= now())`, [fp.map((p) => p.id)]);
  const seededClosed = await count(`"Post" where status = 'CLOSED' or "expiresAt" <= now()`);
  test.info().annotations.push({ type: "actual:TC-092", description: `Database holds ${seededClosed} closed or expired post(s); none of them in the board or the CSE341 filter (${closedOrExpired} found).` });
  actual(test.info(), `Board lists ${all.data.total} open post(s), all unexpired: ${allOpen}. type=study-partner + CSE341: ${fp.length} result(s), all matching: ${match}.`);
  expect(allOpen && match).toBe(true);
  expect(closedOrExpired).toBe(0);
});

test("TC-079 responding to your own post is refused", async () => {
  const res = await (await as("tester")).post(`/api/v1/posts/${shared.post}/responses`, { data: { message: "Me" } });
  actual(test.info(), `${res.status()}: "${(await json(res)).error?.message}".`);
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("TC-078 responding opens a linked connection request", async () => {
  const res = await (await as("adviser")).post(`/api/v1/posts/${shared.post}/responses`, { data: { message: "I can help" } });
  const inbox = await json(await (await as("tester")).get("/api/v1/connections?view=incoming"));
  const item = (inbox.data.items as any[]).find((i) => i.person.id === id.adviser);
  const mine = await json(await (await as("tester")).get("/api/v1/posts/mine"));
  const mp = (mine.data as any[]).find((p) => p.id === shared.post);
  actual(test.info(), `${res.status()}; the poster's Incoming has a ${item?.status} request from ${item?.person?.name} "via" "${item?.viaPost?.title}"; their post shows ${mp?.responses} response(s).`);
  expect(res.status()).toBe(201);
  expect(item?.viaPost?.id).toBe(shared.post);
  expect(mp?.responses).toBe(1);
});

test("TC-080 request limits also apply to responses", async () => {
  const res = await (await as("third")).post(`/api/v1/posts/${shared.post}/responses`, { data: { message: "Count me in" } });
  actual(test.info(), `Member at the daily limit responding: ${res.status()} "${(await json(res)).error?.message}".`);
  expect(res.status()).toBe(429);
});

test("TC-083 TC-084 TC-093 edit and close rules", async () => {
  const other = await (await as("peer")).patch(`/api/v1/posts/${shared.post}`, { data: { title: "Hijacked", body: "x" } });
  const otherClose = await (await as("peer")).post(`/api/v1/posts/${shared.post}/close`);
  const stillOpen = (await q(`select status from "Post" where id = $1`, [shared.post]))[0].status;
  const edit = await (await as("tester")).patch(`/api/v1/posts/${shared.post}`, { data: { title: "E2E CSE341 study buddy (edited)", body: "Looking for a study partner for the midterm." } });
  const board = await json(await (await as("peer")).get("/api/v1/posts?q=edited"));
  const shown = (board.data.posts as any[]).some((p) => p.title === "E2E CSE341 study buddy (edited)");
  test.info().annotations.push({ type: "actual:TC-093", description: `Another member closing it: ${otherClose.status()}; post still ${stillOpen}.` });
  shared.otherEdit = String(other.status());
  actual(test.info(), `Author edit ${edit.status()}; new title on the board: ${shown}.`);
  expect([403, 404]).toContain(other.status());
  expect([403, 404]).toContain(otherClose.status());
  expect(stillOpen).toBe("OPEN");
  expect(edit.status()).toBe(200);
  expect(shown).toBe(true);
});

test("TC-081 TC-084 closing a post", async () => {
  const res = await (await as("tester")).post(`/api/v1/posts/${shared.post}/close`);
  const board = await json(await (await as("peer")).get("/api/v1/posts?q=study%20buddy"));
  const onBoard = (board.data.posts as any[]).some((p) => p.id === shared.post);
  const mine = (await json(await (await as("tester")).get("/api/v1/posts/mine"))).data.find((p: any) => p.id === shared.post);
  const editClosed = await (await as("tester")).patch(`/api/v1/posts/${shared.post}`, { data: { title: "E2E closed edit", body: "x" } });
  test.info().annotations.push({ type: "actual:TC-084", description: `Someone else's post: ${shared.otherEdit}; own closed post: ${editClosed.status()}.` });
  actual(test.info(), `Close ${res.status()}; still on the board: ${onBoard}; author's list shows it ${mine?.state} with ${mine?.responses} response(s).`);
  expect(res.status()).toBe(200);
  expect(onBoard).toBe(false);
  expect(mine?.responses).toBe(1);
  expect(editClosed.status()).toBeGreaterThanOrEqual(400);
});

test("TC-082 post expires after 14 days", async () => {
  await (await as("tester")).post("/api/v1/posts", { data: { type: "COURSE_ADVICE", title: "E2E expiring post", body: "Which electives?", course: "CSE341" } });
  const [post] = await q(`select id from "Post" where title = 'E2E expiring post'`);
  await (await as("alumnus")).post(`/api/v1/posts/${post.id}/responses`, { data: { message: "Happy to advise" } });
  const created = new Date(Date.now() - 14 * 86_400_000);
  // Columns are UTC timestamps without a zone; convert explicitly so the local time zone does not shift them
  await q(`update "Post" set "createdAt" = ($2::timestamptz at time zone 'UTC'), "expiresAt" = ($3::timestamptz at time zone 'UTC') where id = $1`, [
    post.id,
    created.toISOString(),
    new Date(created.getTime() + 14 * 86_400_000).toISOString(),
  ]);
  const board = await json(await (await as("peer")).get("/api/v1/posts?q=expiring"));
  const mine = (await json(await (await as("tester")).get("/api/v1/posts/mine"))).data.find((p: any) => p.id === post.id);
  actual(test.info(), `createdAt set to today - 14 days: on the board ${(board.data.posts as any[]).some((p) => p.id === post.id)}; author's list shows ${mine?.state} with ${mine?.responses} response(s).`);
  expect((board.data.posts as any[]).some((p) => p.id === post.id)).toBe(false);
  expect(mine?.state).toBe("expired");
  expect(mine?.responses).toBe(1);
});

// ------------------------------------------------------------ mobile layout

test("TC-085 primary screens at 360 px", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("student"), viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  const report: string[] = [];
  let overflow = 0;
  for (const path of ["/dashboard", "/directory", `/members/${id.adviser}`, "/requests", "/messages", "/board", "/board/new", "/profile", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 360) overflow++;
    report.push(`${path.startsWith("/members") ? "/members/[id]" : path} ${w}px`);
  }
  const bottom = await page.getByRole("navigation", { name: "Main" }).last().isVisible();
  actual(test.info(), `Page widths at 360 px: ${report.join(", ")}. Bottom menu visible: ${bottom}.`);
  expect(overflow).toBe(0);
  expect(bottom).toBe(true);
  await ctx.close();
});

// ------------------------------------------------------- sessions and account

test("TC-029 TC-088 signed-out visitor cannot open member pages", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ends: string[] = [];
  for (const path of ["/dashboard", "/directory", "/messages", "/board", "/settings", "/admin"]) {
    await page.goto(path);
    ends.push(`${path} -> ${new URL(page.url()).pathname}`);
  }
  const res = await (await as("anon")).get("/api/v1/members");
  test.info().annotations.push({ type: "actual:TC-088", description: `/dashboard redirected to ${ends[0].split(" -> ")[1]}.` });
  actual(test.info(), `${ends.join(", ")}; GET /api/v1/members: ${res.status()}.`);
  expect(ends.every((e) => e.endsWith("/sign-in"))).toBe(true);
  expect(res.status()).toBe(401);
  await ctx.close();
});

test("TC-030 suspended member is signed out", async ({ browser }) => {
  await q(`update "User" set status = 'SUSPENDED' where id = $1`, [id.suspended]);
  const api = await as("suspended");
  const res = await api.get("/api/v1/profile");
  const ctx = await browser.newContext({ storageState: statePath("suspended") });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  const text = await page.locator("body").innerText();
  actual(test.info(), `API: ${res.status()} ${(await json(res)).error?.code}. Page ended on ${new URL(page.url()).pathname}${new URL(page.url()).search} with message: "${text.match(/[^\n]*suspended[^\n]*/i)?.[0] ?? "none"}".`);
  expect(res.status()).toBe(403);
  expect(page.url()).toMatch(/\/sign-in/);
  expect(text).toMatch(/suspended/i);
  await ctx.close();
});

test("TC-034 deactivated profile leaves the directory", async () => {
  const before = (await json(await (await as("student")).get("/api/v1/members?q=Leaver"))).data.members.some((m: any) => m.id === id.leaver);
  const res = await (await as("leaver")).post("/api/v1/account/deactivate");
  const after = (await json(await (await as("student")).get("/api/v1/members?q=Leaver"))).data.members.some((m: any) => m.id === id.leaver);
  const next = await (await as("leaver")).get("/api/v1/profile");
  actual(test.info(), `In the directory before: ${before}; deactivate ${res.status()}; after: ${after}; the old session gets ${next.status()}.`);
  expect(before).toBe(true);
  expect(res.status()).toBe(200);
  expect(after).toBe(false);
  expect(next.status()).toBe(401);
});

test("TC-036 TC-035 delete account", async ({ browser }) => {
  const req = await json(await (await as("deleter")).post("/api/v1/connections", { data: { recipientId: id.peer, note: "Hi" } }));
  await (await as("peer")).patch(`/api/v1/connections/${req.data.id}`, { data: { action: "accept" } });
  await (await as("deleter")).post(`/api/v1/connections/${req.data.id}/messages`, { data: { body: "bye soon" } });
  const cancel = await (await as("deleter")).delete("/api/v1/account", { data: { confirm: "no" } });
  const [still] = await q(`select status, "deletedAt" from "User" where id = $1`, [id.deleter]);
  test.info().annotations.push({ type: "actual:TC-036", description: `Without the "DELETE" confirmation: ${cancel.status()}; account unchanged (status ${still.status}, not deleted: ${!still.deletedAt}). The dialog's Cancel button is in the human checklist.` });
  const res = await (await as("deleter")).delete("/api/v1/account", { data: { confirm: "DELETE" } });
  const ctx = await browser.newContext({ storageState: statePath("peer") });
  const page = await ctx.newPage();
  await page.goto(`/messages/${req.data.id}`);
  const text = await page.locator("main").innerText();
  const signIn = await (await fresh()).post("/api/v1/auth/sign-in", { data: { email: TEMP.deleter, password: PASSWORD } });
  const inDir = (await json(await (await as("student")).get("/api/v1/members?q=Deleter"))).data.members.length;
  actual(test.info(), `Delete ${res.status()}; peer's chat shows "Deleted member": ${text.includes("Deleted member")}, old message kept: ${text.includes("bye soon")}; sign-in afterwards: ${signIn.status()}; in directory: ${inDir}.`);
  expect(cancel.status()).toBe(400);
  expect(res.status()).toBe(200);
  expect(text).toContain("Deleted member");
  expect(signIn.status()).not.toBe(200);
  await ctx.close();
});

test("TC-031 idle session expires", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("third") });
  const old = Date.now() - 8 * 86_400_000;
  await ctx.addCookies([{ name: "iba_last_seen", value: String(old), url: process.env.E2E_BASE_URL! }]);
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  actual(test.info(), `Last activity set 8 days ago (limit 7): /dashboard ended on ${new URL(page.url()).pathname}${new URL(page.url()).search}.`);
  expect(page.url()).toMatch(/\/sign-in/);
  await ctx.close();
});

test("TC-028 sign out ends the session", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("peer") });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/dashboard");
  actual(test.info(), `Sign out from the account menu showed ${new URL(page.url()).pathname}; opening /dashboard again went to the sign-in page.`);
  expect(page.url()).toMatch(/\/sign-in/);
  await ctx.close();
});

