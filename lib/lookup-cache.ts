import "server-only";

/**
 * A tiny cache for rarely-changing lookup lists (courses, skills) that every page of a kind
 * reads. It lives in the memory of one server instance:
 *
 * - invalidate() drops the entry on this instance straight away; call it after the change has been
 *   committed, never before, or a read in between would cache the old data again.
 * - Other instances only learn about a change when the entry expires (ttlMs), so the data can be
 *   at most one TTL out of date there.
 * - A failed load is never kept.
 *
 * The TTL is read on every call, so LOOKUP_CACHE_TTL_MS=0 switches caching off (integration tests do
 * this because they write straight to the database).
 */
export const DEFAULT_LOOKUP_TTL_MS = 60_000;

export function lookupTtlMs(): number {
  const raw = process.env.LOOKUP_CACHE_TTL_MS;
  const ms = raw === undefined || raw === "" ? DEFAULT_LOOKUP_TTL_MS : Number(raw);
  return Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_LOOKUP_TTL_MS;
}

export function lookupCache<T>(load: () => Promise<T>) {
  let entry: { value: Promise<T>; expiresAt: number } | null = null;
  return {
    get(now = Date.now()): Promise<T> {
      if (entry && entry.expiresAt > now) return entry.value;
      const mine = { value: load(), expiresAt: now + lookupTtlMs() };
      // Set before the load finishes: an invalidate() that arrives meanwhile removes this entry too
      entry = mine;
      mine.value.catch(() => {
        if (entry === mine) entry = null;
      });
      return mine.value;
    },
    invalidate() {
      entry = null;
    },
  };
}
