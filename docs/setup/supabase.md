# Supabase setup

One-time configuration of the team's Supabase project. Secrets go in `.env.local` and in Vercel, never in the repository.

## 1. Project and keys

1. Create a free project (region: Singapore or Mumbai).
2. **Project Settings → API**: copy the URL, the `anon` key and the `service_role` key into `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Project Settings → Database → Connection string**:
   - `DATABASE_URL`: *Transaction pooler* (port 6543), with `?pgbouncer=true` appended
   - `DIRECT_URL`: *Session pooler* or direct connection (port 5432)
4. Apply the schema and demo data: `npm run db:deploy` then `npm run db:seed`.

## 2. Storage

**Storage → New bucket**: name `avatars`, **Public: off**, file size limit 2 MB, allowed types `image/png, image/jpeg, image/webp`. The app uploads with the service-role key and shows photos through signed links that last an hour, so no storage policies are needed.

## 3. Authentication settings

**Authentication → URL Configuration**

- Site URL: the production URL (for local work: `http://localhost:3000`)
- Redirect URLs: `http://localhost:3000/**` and the Vercel URLs (`https://<project>.vercel.app/**`, `https://*-<team>.vercel.app/**` for previews)

**Authentication → Providers → Email**

- Enable email provider, **Confirm email: on**
- Minimum password length: 8

**Authentication → Email Templates**: the app verifies links on the server at `/auth/confirm`, so each template must use the token hash:

| Template | Link |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/profile/setup` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

**Idle sessions (FR1.6)** are handled by the app, because Supabase's inactivity timeout needs a paid plan: set `SESSION_IDLE_DAYS` (default 7, to be confirmed by the team).

## 4. Email through Brevo (custom SMTP)

Supabase's built-in email is heavily rate-limited, so Auth emails go through Brevo.

**Project Settings → Authentication → SMTP Settings**: enable custom SMTP.

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Brevo SMTP login (SMTP & API → SMTP) |
| Password | Brevo SMTP key |
| Sender email | the verified Brevo sender (same as `EMAIL_FROM_ADDRESS`) |
| Sender name | IBA Connect |

The app's own notification emails (for example new connection requests) use the Brevo API key in `BREVO_API_KEY`.

## 5. Microsoft sign-in (FR1.1)

Set up in backlog item US1.1. Until then, email and password sign-in carries the demo.
