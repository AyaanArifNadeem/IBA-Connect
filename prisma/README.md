# Database

Prisma 7 schema, migrations and seed for IBA Connect. The schema follows SRS section 6.

| Command | What it does |
|---|---|
| `npm run db:migrate` | Create and apply a migration in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply pending migrations (CI, Supabase) |
| `npm run db:seed` | Load demo courses, skills and fictional members |
| `npm run db:studio` | Browse the data |

The client is generated into `lib/generated/prisma` on `npm install` (git-ignored). App code imports the shared client from `lib/db.ts`.

## Rules kept in SQL

Some rules cannot be written in `schema.prisma`, so they live at the end of `migrations/*_init/migration.sql`:

- Check constraints: no connection request to yourself, no blocking yourself.
- `Connection_active_pair_key`: at most one pending or accepted connection between two members.
- Row-level security on every table, with the Supabase `anon` and `authenticated` roles denied. All data goes through the server-side API (NFR7).

When you create a migration, use `npm run db:migrate -- --create-only --name <name>`, read the SQL, and make sure it does not drop any of the above. CI fails if the schema and the migrations drift apart.

## Seed data

Seeded members are fictional, use the reserved `.test` email domain and cannot sign in. Admins are made only by listing their email in `SEED_ADMIN_EMAILS` and running the seed (FR8.5).
