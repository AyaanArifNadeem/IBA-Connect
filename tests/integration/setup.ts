/**
 * Integration tests run against a real, migrated Postgres database given by TEST_DATABASE_URL
 * (CI starts one; locally point it at a throwaway database). The app's DATABASE_URL is set to
 * the same database so modules that import lib/db use it too.
 */
import { vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Integration tests need a migrated Postgres database " +
      "(run: npx prisma migrate deploy with DATABASE_URL pointing at it).",
  );
}
process.env.DATABASE_URL = url;
// Tests write straight to the database, so the short-lived course/skill list cache is off by default
process.env.LOOKUP_CACHE_TTL_MS = "0";

// Route handlers are called directly in these tests, outside a Next.js request, where
// `connection()` (used to mark the session lookup as request-time) is not available.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
