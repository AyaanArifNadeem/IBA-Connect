# Contributing to IBA Connect

We follow Agile Scrum with a GitFlow branching model. Every change starts as a backlog item on the Trello board and reaches `develop` through a pull request.

## 1. Branches

| Branch | Branch from | Merge into | Notes |
|---|---|---|---|
| `feature/<story>-<slug>` | `develop` | `develop` | One per backlog item, e.g. `feature/US1.2-email-registration` |
| `fix/<id>-<slug>` | `develop` | `develop` | Bugs found during the sprint |
| `docs/<slug>` | `develop` | `develop` | Documentation |
| `chore/<slug>` | `develop` | `develop` | Tooling, CI, dependencies, structure |
| `release/sprint-N` | `develop` | `main`, then back into `develop` | Fixes only; tag `v0.N.0` on `main` |
| `hotfix/<slug>` | `main` | `main` and `develop` | Urgent production fixes |

Rules:

- Never commit directly to `main` or `develop`.
- Never force-push a shared branch.
- Pull `develop` before you start a new branch.
- Delete your branch after it is merged.

## 2. Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope, and include the backlog reference when there is one:

```
feat(auth): add email verification page (US1.2, FR1.2)
fix(directory): keep filters when changing page (US2.3)
test(requests): cover daily request limit (US3.2)
docs(srs): v1.1 update email provider
chore(ci): run type-check on pull requests
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `style`, `chore`, `ci`, `build`, `perf`.

Keep commits small and focused. The subject is imperative, lower case, no full stop, at most 72 characters.

## 3. Pull requests

1. Push your branch and open a PR **into `develop`** (`gh pr create --base develop`).
2. Fill in the PR template: summary, FR/US IDs, Trello card, how you tested it, screenshots for UI changes, and the Definition of Done checklist.
3. Request a review from at least one teammate.
4. Merge with **"Create a merge commit"** only after CI is green, the review is approved and the checklist is complete.

## 4. Definition of Done

A backlog item is done when:

- [ ] Its acceptance criteria are met
- [ ] Code is reviewed and merged by pull request
- [ ] Lint, type-check and tests pass in CI
- [ ] Its test cases are executed and the results recorded in `docs/testing/`
- [ ] It is deployed to a Vercel preview or production
- [ ] It is accepted by the Product Owner

## 5. Code standards

- TypeScript strict mode; no `any` without a comment explaining why.
- Validate every API input with Zod on the server, and check authorisation server-side on every route. Never rely on client-side checks.
- Never return a member's email unless the two members have an accepted connection.
- Secrets go in `.env.local` and Vercel only. Add any new variable to `.env.example`.
- UI follows the wireframes (P00–P21) and works at 360 px width.
