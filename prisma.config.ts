import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Same files Next.js reads: .env.local first, then .env
config({ path: ".env.local", quiet: true });
config({ quiet: true });

// Migrations use the direct (non-pooled) connection; the app uses DATABASE_URL at runtime.
// Falls back to DATABASE_URL so CI only needs one variable.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: migrationUrl ? { url: migrationUrl } : undefined,
});
