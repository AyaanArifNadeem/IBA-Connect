# IBA Connect

A verified, IBA-only web platform for finding the right person on campus. IBA students and alumni sign in with a verified IBA identity, build a profile of their courses and skills, search for the person they need (a study partner, a senior who took a course, a project teammate, an alumnus in a field), connect and chat, and post needs to a shared board.

Software Engineering course project (Fall 2026), team **NameNotFound**.

> **This is the team's official repository.** All work goes through the `develop` branch by pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| API | Route handlers under `/api/v1`, Zod validation |
| Data | PostgreSQL on Supabase, Prisma ORM, row-level security |
| Auth | Supabase Auth: Microsoft (Entra ID) sign-in and email + password fallback |
| Storage | Supabase Storage (avatars) |
| Email | Brevo (transactional email and Supabase Auth SMTP) |
| Hosting | Vercel |
| CI | GitHub Actions |

## Getting started

Requirements: Node.js 22 or newer, npm, Git.

```bash
git clone https://github.com/AyaanArifNadeem/IBA-Connect.git
cd IBA-Connect
git switch develop
npm ci
cp .env.example .env.local   # then fill in the values (ask the Technical Lead)
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

All variables are listed with comments in [`.env.example`](.env.example). Real values live only in `.env.local` (git-ignored) and in the Vercel project settings. Never commit secrets.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

More scripts (type-check, tests, database) are added as the tooling lands; this table is kept up to date.

## Project layout

```
app/
  (auth)/        sign-in, register, forgot-password, reset-password, ...
  (app)/         signed-in pages (dashboard, directory, requests, messages, board, ...)
  (admin)/       admin pages
  api/v1/        REST route handlers
components/      shared components (ui/ = shadcn/ui)
lib/             db, supabase, auth, validation, services, rate limiting
prisma/          schema, migrations, seed
public/          static assets
tests/           unit/ and e2e/
docs/            LaTeX sources for project documentation
```

## Branching model (GitFlow)

| Branch | Purpose |
|---|---|
| `main` | Production. Changes only by PR from `release/*` or `hotfix/*`; every merge is tagged. |
| `develop` | Integration branch. Changes only by PR from `feature/*`, `fix/*`, `docs/*`, `chore/*`. |
| `feature/<story>-<slug>` | One per backlog item, e.g. `feature/US2.3-directory-filters`. |
| `release/sprint-N` | Stabilisation before each sprint review. |

Details, commit conventions and the Definition of Done are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Team

| Member | Scrum role |
|---|---|
| Ayaan Arif Nadeem | Product Owner |
| Ahsan Haris | Scrum Master |
| Ahmed Abdul Rahim | Technical Lead |
| Muhammad Mujtaba Khurram | Frontend Developer |
| Ebad ur Rahman | UI/UX Designer |
| Shaharyar Ahmed | QA / Test Lead |

Instructor: Mr. Ahsan Jawed.
