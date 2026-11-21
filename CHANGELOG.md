# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-21

Sprint 1 release: features F1 to F4 of the SRS (FR1.1 to FR4.5, US1.1 to US4.5).

### Added
- **Identity and verified profile (F1)**
  - Email and password registration with email verification, sign-in and resend-verification (US1.2).
  - Forgot, reset and change password (US1.3).
  - Sign-in with Microsoft for `@khi.iba.edu.pk` accounts (US1.1).
  - Alumni verification with an administration code or a personal email on the alumni list (US1.4).
  - Sign-out, idle session expiry, and suspended members signed out (FR1.6).
  - Profile setup on first sign-in, edit profile and profile photo (US1.5, US1.6).
  - Field and company for alumni (US1.7) and "available to advise" per course (US1.8).
  - Dashboard with pending requests, unread messages and open posts (FR1.7).
  - Deactivate or delete your account (FR1.8).
  - Admin pages for alumni codes, the alumni list and the course list (FR1.9, FR1.10).
- **Directory and search (F2)**
  - Member directory and member profile pages (US2.1, US2.6).
  - Free-text search over name, skills and courses (US2.2).
  - Filters for course, skill, available to advise, batch, department, programme, and alumni field and company (US2.3 to US2.5).
- **Connections and messaging (F3)**
  - Connection requests with a note, a daily limit and a cooldown after a decline (US3.1, US3.2).
  - Accept or decline, and the requests inbox with incoming, outgoing and accepted tabs (US3.3, US3.4).
  - Private chat between connected members (US3.5) and unread indicators (US3.6).
  - Email address visible only to accepted connections (US3.7).
  - Email to the recipient when a request arrives (FR3.6).
  - Block a member (FR3.7).
- **Need Board (F4)**
  - Post a need with a type and an optional course or department tag (US4.1).
  - Browse and filter open posts (US4.2) and respond to a post (US4.3).
  - Close posts early, expiry after 14 days, and My posts with the responses (US4.4, US4.5).
  - Edit your own open post (FR4.5).
- **Foundation**
  - Database schema with row-level security, migrations and a demo seed.
  - API with standard JSON errors, request validation, access guards, rate limiting and Brevo email.
  - Signed-in app shell with top menu, phone bottom bar and account menu.
  - Continuous integration: lint, type-check, unit, integration and end-to-end tests, build, and LaTeX documents.
- **Documentation**
  - SRS v1.1, use cases and user stories, product and Sprint 1 backlogs, architecture and ERD, OpenAPI spec.
  - Test plan, 93 Sprint 1 test cases and test results (91 passed, 0 failed, 2 not yet run), and the user manual.

### Changed
- The Next.js app moved from `iba-connect-frontend/` to the repository root; auth pages are grouped under `app/(auth)/`.
- Email provider is Brevo instead of Resend (SRS v1.1).

### Fixed
- Account menu crash, sideways scrolling of the directory on phones, the empty search message, and a server error on invalid alumni emails (found by the real-backend test run).

[Unreleased]: https://github.com/AyaanArifNadeem/IBA-Connect/compare/v0.1.0...develop
[0.1.0]: https://github.com/AyaanArifNadeem/IBA-Connect/releases/tag/v0.1.0
