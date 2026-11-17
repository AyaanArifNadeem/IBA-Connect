import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type Client = ReturnType<typeof createPrismaClient>;

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function getClient(): Client {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * Shared Prisma client, created on first use so that importing this module (for example
 * while Next.js builds) does not need a database connection.
 */
export const db = new Proxy({} as Client, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
