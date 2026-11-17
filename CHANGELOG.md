# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Sign-in, register, forgot-password and reset-password pages with client-side validation.
- Project documentation: README, CONTRIBUTING, environment template, pull request and issue templates.

- Continuous integration: lint, type-check, unit tests, build and end-to-end tests on every pull request.
- Database schema for Sprint 1 (identity, profiles, courses, skills, connections, messages, Need Board, audit log), first migration with row-level security, and a demo seed.
- Signed-in app shell with top menu, phone bottom bar and account menu; shadcn/ui components and IBA theme.

### Changed
- The Next.js app moved from `iba-connect-frontend/` to the repository root; auth pages are grouped under `app/(auth)/`.
