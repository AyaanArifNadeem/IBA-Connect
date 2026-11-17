/**
 * Integration tests run against a real, migrated Postgres database given by TEST_DATABASE_URL
 * (CI starts one; locally point it at a throwaway database). The app's DATABASE_URL is set to
 * the same database so modules that import lib/db use it too.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Integration tests need a migrated Postgres database " +
      "(run: npx prisma migrate deploy with DATABASE_URL pointing at it).",
  );
}
process.env.DATABASE_URL = url;
