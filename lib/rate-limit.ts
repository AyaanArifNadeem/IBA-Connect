import "server-only";
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
 */
export async function enforceRateLimit(rule: RateLimitRule, now = new Date()): Promise<void> {
  const since = new Date(now.getTime() - rule.windowMs);

  const hits = await db.rateLimitHit.findMany({
    where: { key: rule.key, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    take: rule.limit,
  });

  if (hits.length >= rule.limit) {
    const oldest = hits[0].createdAt.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + rule.windowMs - now.getTime()) / 1000));
    throw rateLimited(rule.message ?? "Too many attempts. Please wait and try again.", retryAfterSeconds);
  }

  await db.rateLimitHit.create({ data: { key: rule.key, userId: rule.userId, createdAt: now } });

  // Occasionally clear counters older than a day so the table stays small.
  if (Math.random() < 0.02) {
    await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  }
}

/** Limits for authentication endpoints (NFR20), per client IP. */
export const AUTH_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  alumniVerify: { limit: 10, windowMs: 60 * 60_000 },
} as const;
