import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/api/errors";

export type RateLimitRule = {
  /** Counter key, e.g. `auth:sign-in:${ip}` */
  key: string;
  /** Maximum hits allowed inside the window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
  /** Message shown when the limit is reached */
  message?: string;
  userId?: string;
};

/**
 * Sliding-window limiter stored in Postgres (NFR20), so no extra service is needed.
 * Records a hit when allowed; throws a 429 ApiError with Retry-After when not.
 *
 * The check and the insert are one call to the `rate_limit_hit` database function (one round trip,
 * serialised per key, so simultaneous requests cannot all slip under the limit).
 */
export async function enforceRateLimit(rule: RateLimitRule, now = new Date()): Promise<void> {
  const since = new Date(now.getTime() - rule.windowMs);

  const [result] = await db.$queryRaw<{ allowed: boolean; oldest_ms: number | null }[]>`
    SELECT "allowed", "oldest_ms"
      FROM "rate_limit_hit"(
        ${rule.key},
        ${rule.userId ?? null}::uuid,
        ${since.toISOString()}::timestamptz,
        ${now.toISOString()}::timestamptz,
        ${rule.limit}::integer,
        ${randomUUID()}::uuid
      )`;

  if (!result.allowed) {
    const oldest = result.oldest_ms ?? now.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + rule.windowMs - now.getTime()) / 1000));
    throw rateLimited(rule.message ?? "Too many attempts. Please wait and try again.", retryAfterSeconds);
  }

  // Occasionally clear counters older than a day so the table stays small. This is housekeeping, so
  // it runs after the response has been sent instead of delaying the request.
  if (Math.random() < 0.02) scheduleCleanup(now);
}

function scheduleCleanup(now: Date) {
  const cleanup = async () => {
    try {
      await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
    } catch (err) {
      console.warn("[rate-limit] cleanup failed", { reason: err instanceof Error ? err.message : "unknown" });
    }
  };
  try {
    after(cleanup);
  } catch {
    // Not inside a request (scripts, tests): skipping is fine, the next run will do it
  }
}

/** Limits for authentication endpoints (NFR20), per client IP. */
export const AUTH_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  alumniVerify: { limit: 10, windowMs: 60 * 60_000 },
} as const;
