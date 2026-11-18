#!/usr/bin/env node
/**
 * One-time Supabase setup (docs/setup/supabase.md), safe to run again:
 *  - private "avatars" storage bucket (images only, 2 MB)
 *  - Auth settings: site URL, redirect URLs, minimum password length, and the email templates
 *    that send links to /auth/confirm (needs SUPABASE_ACCESS_TOKEN, a personal access token)
 *
 *   node scripts/supabase-setup.mjs [--site-url https://your-app.vercel.app]
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const siteArg = process.argv.indexOf("--site-url");
const siteUrl = siteArg > -1 ? process.argv[siteArg + 1] : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const projectRef = new URL(url).hostname.split(".")[0];

// 1. Storage bucket for profile photos (US1.6)
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const bucket = { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] };
const { data: existing } = await supabase.storage.getBucket("avatars");
const { error: bucketError } = existing
  ? await supabase.storage.updateBucket("avatars", bucket)
  : await supabase.storage.createBucket("avatars", bucket);
if (bucketError) throw bucketError;
console.log(`Storage: "avatars" bucket ${existing ? "updated" : "created"} (private, images, 2 MB)`);

// 2. Auth settings through the Management API
if (!token) {
  console.log("Auth: SUPABASE_ACCESS_TOKEN not set, so set the URLs and templates in the dashboard (docs/setup/supabase.md).");
  process.exit(0);
}

const confirmTemplate = `<h2>Confirm your IBA Connect account</h2>
<p>Welcome to IBA Connect! Confirm your email to finish creating your account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/profile/setup">Confirm my email</a></p>
<p>If you did not sign up, you can ignore this email.</p>`;
const recoveryTemplate = `<h2>Reset your IBA Connect password</h2>
<p>Someone asked to reset the password for this account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
<p>If this was not you, you can ignore this email; your password will not change.</p>`;

const settings = {
  site_url: siteUrl,
  uri_allow_list: ["http://localhost:3000/**", `${siteUrl}/**`, "https://*.vercel.app/**"].filter((v, i, a) => a.indexOf(v) === i).join(","),
  password_min_length: 8,
  mailer_autoconfirm: false,
  mailer_subjects_confirmation: "Confirm your IBA Connect account",
  mailer_templates_confirmation_content: confirmTemplate,
  mailer_subjects_recovery: "Reset your IBA Connect password",
  mailer_templates_recovery_content: recoveryTemplate,
};

const patch = (body) =>
  fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let res = await patch(settings);
let templates = true;
if (res.status === 400 && (await res.clone().text()).includes("auth.email_templates")) {
  // Free projects can only change templates once custom SMTP (Brevo) is configured
  templates = false;
  const withoutTemplates = Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith("mailer_subjects_") && !key.startsWith("mailer_templates_")));
  res = await patch(withoutTemplates);
}
if (!res.ok) {
  console.error(`Auth: the Management API refused the update (HTTP ${res.status}). ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const applied = await res.json();
console.log(`Auth: site URL ${applied.site_url}; redirect URLs ${applied.uri_allow_list}; min password ${applied.password_min_length}`);
console.log(
  templates
    ? "Auth: email templates set (links go to /auth/confirm)"
    : "Auth: email templates NOT set yet: Supabase allows it only after custom SMTP (Brevo) is configured. Run this script again after that.",
);
