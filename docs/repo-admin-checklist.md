# Repository admin checklist

These settings need **Admin** access to `AyaanArifNadeem/IBA-Connect`. The team currently has Write access, so the repository owner (or anyone given Admin) should complete them. Tick each item in a `docs/*` pull request when it is done.

- [ ] **Default branch:** Settings → General → Default branch → `develop`
- [ ] **Branch protection** for `main` and `develop` (Settings → Branches → Add rule):
  - [ ] Require a pull request before merging (no required approvals for now)
  - [ ] Require status checks to pass: the CI jobs *Lint, type-check, unit tests*, *Database migrations, seed and integration tests*, *Build and end-to-end tests*
  - [ ] Block force pushes
  - [ ] Block deletion
- [ ] **Merge settings** (Settings → General → Pull Requests): allow merge commits only (turn off squash and rebase merging); turn on *Automatically delete head branches*
- [ ] **About:** description "IBA Connect: verified campus network for IBA students and alumni", topics (`nextjs`, `typescript`, `supabase`, `prisma`, `scrum`), and the Vercel URL once deployed
- [ ] **Collaborators:** add every team member with Write access
- [ ] **Vercel:** install the Vercel GitHub app on this repository so pull requests get preview deployments
