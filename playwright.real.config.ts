import { defineConfig, devices } from "@playwright/test";

/**
 * Real-backend tests: the running app (E2E_BASE_URL) against the team's Supabase project.
 * Uses the demo accounts (npm run db:demo) plus throwaway accounts created and deleted per run.
 * Not part of CI (it needs the project's secrets).
 *
 *   E2E_BASE_URL=http://localhost:3100 npm run test:e2e:real
 */
export default defineConfig({
  testDir: "./tests/e2e-real",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/real-backend.json" }]],
  globalSetup: "./tests/e2e-real/global-setup.ts",
  globalTeardown: "./tests/e2e-real/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "real-backend", use: { ...devices["Desktop Chrome"] } }],
});
