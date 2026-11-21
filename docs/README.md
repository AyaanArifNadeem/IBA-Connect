# Project documentation

Living documents for the course, written in LaTeX and kept in the repository so every change is reviewed through a pull request (`docs/*` branches).

| Folder | Documents |
|---|---|
| `backlog/` | Product backlog: every FR with priority, user stories, sprint and points |
| `sprint-1/` | Sprint backlog, planning minutes, daily scrum log, burndown (`burndown-data.csv`), sprint review, retrospective |
| `testing/` | Test plan, test cases (course template columns) and results |
| `srs/` | Software Requirements Specification (versioned) |
| `requirements/` | Use cases and user stories |
| `api/` | OpenAPI 3.1 specification for `/api/v1` (`openapi.yaml`, kept in sync with the routes by a test) |
| `architecture/` | Architecture and ERD (kept in sync with `prisma/schema.prisma`) |
| `manual/` | User manual with screenshots of the real app |
| `common/` | Shared style (`ibaconnect.sty`) |

## Building the PDFs

You need a LaTeX distribution with `pdflatex` (MiKTeX on Windows, TeX Live on Linux/macOS).

```bash
npm run docs:build            # every document
npm run docs:build -- sprint  # only paths containing "sprint"
```

PDFs go to `docs/build/` (git-ignored). CI builds every document on pull requests that touch `docs/` and attaches the PDFs to the run. For submission, copy the PDFs into the matching folder of the team's project folder.

## Honesty rule

Meeting minutes, daily scrum entries, attendance, who did what, points completed and test results must reflect what really happened. The sprint documents are templates until the team fills them in from real meetings and real test runs.
