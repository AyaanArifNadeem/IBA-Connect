/**
 * Screenshots for the user manual (docs/manual/figures), taken from the running app with the
 * demo accounts (npm run db:demo). Run after resetting the demo data:
 *
 *   npm run db:seed && npm run db:demo
 *   MANUAL_BASE_URL=http://localhost:3000 node scripts/manual-screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const BASE = process.env.MANUAL_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD;
const OUT = "docs/manual/figures";
if (!PASSWORD) throw new Error("DEMO_ACCOUNT_PASSWORD is not set");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let ip = 20;

async function contextFor(email, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, deviceScaleFactor: 1, extraHTTPHeaders: { "x-forwarded-for": `10.99.0.${ip++}` } });
  if (email) {
    const res = await ctx.request.post("/api/v1/auth/sign-in", { data: { email, password: PASSWORD } });
    if (!res.ok()) throw new Error(`Sign-in failed for ${email}: ${res.status()}`);
  }
  return ctx;
}

async function shot(ctx, path, name, prepare) {
  const page = await ctx.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  if (prepare) await prepare(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await page.close();
  console.log(`  ${name}.png`);
}

const firstHref = async (page, selector) => page.locator(selector).first().getAttribute("href");

// Signed out
const anon = await contextFor(null);
await shot(anon, "/", "landing");
await shot(anon, "/register", "register");
await shot(anon, "/sign-in", "sign-in");
await shot(anon, "/forgot-password", "forgot-password");
await shot(anon, "/verify-alumni", "verify-alumni");
await shot(anon, "/verify?email=new.member%40khi.iba.edu.pk", "verify-email");
await anon.close();

// New account: profile setup
const newbie = await contextFor("newbie@khi.iba.edu.pk");
await shot(newbie, "/profile/setup", "profile-setup");
await newbie.close();

// Student
const student = await contextFor("student@khi.iba.edu.pk");
await shot(student, "/dashboard", "dashboard");
await shot(student, "/profile", "profile");
await shot(student, "/profile/edit", "profile-edit");
await shot(student, "/profile/edit", "advising", async (page) => {
  const advise = page.getByText(/available to advise/i).first();
  await advise.scrollIntoViewIfNeeded();
});
await shot(student, "/settings", "settings");
await shot(student, "/settings", "account-actions", async (page) => {
  await page.getByText(/delete/i).last().scrollIntoViewIfNeeded();
});
await shot(student, "/directory", "directory");
await shot(student, "/directory?q=Python", "directory-search");
await shot(student, "/directory?course=CSE341&advise=1", "directory-advise");
await shot(student, "/directory?field=Banking+%26+Finance", "directory-alumni");
const page = await student.newPage();
await page.goto("/directory?course=CSE341&advise=1");
const adviserHref = await firstHref(page, 'main a[href^="/members/"]');
await page.close();
if (adviserHref) await shot(student, adviserHref, "member-profile");
await shot(student, "/requests", "requests-incoming");
await shot(student, "/requests?view=outgoing", "requests-outgoing");
await shot(student, "/requests?view=accepted", "requests-accepted");
await shot(student, "/messages", "messages");
const m = await student.newPage();
await m.goto("/messages");
const chatHref = await firstHref(m, 'main a[href^="/messages/"]');
await m.close();
if (chatHref) await shot(student, chatHref, "chat");
await shot(student, "/board", "board");
await shot(student, "/board?type=study-partner", "board-filter");
await shot(student, "/board/new", "board-new");
await shot(student, "/board/my-posts", "my-posts");
const p = await student.newPage();
await p.goto("/board/my-posts");
const postHref = await firstHref(p, 'main a[href^="/board/my-posts/"]');
await p.close();
if (postHref) {
  await shot(student, postHref, "my-post-detail");
  await shot(student, `${postHref}/edit`, "my-post-edit");
}
await student.close();

// Alumnus
const alumnus = await contextFor("alumnus@khi.iba.edu.pk");
await shot(alumnus, "/profile", "alumnus-profile");
await alumnus.close();

// Admin
const admin = await contextFor("admin@khi.iba.edu.pk");
await shot(admin, "/admin", "admin");
await shot(admin, "/admin/alumni", "admin-alumni");
await shot(admin, "/admin/courses", "admin-courses");
await admin.close();

// Phone width (360 px)
const phone = await contextFor("student@khi.iba.edu.pk", { width: 360, height: 760 });
await shot(phone, "/dashboard", "mobile-dashboard");
await shot(phone, "/directory", "mobile-directory");
await phone.close();

await browser.close();
