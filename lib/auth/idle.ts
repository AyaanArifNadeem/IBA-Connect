/**
 * Idle session expiry (FR1.6). Supabase's own inactivity timeout needs a paid plan, so the
 * proxy keeps the time of the member's last request in a cookie and signs them out when it
 * is older than the limit. The limit is SESSION_IDLE_DAYS (default 7, to be confirmed by the team).
 */
export const LAST_SEEN_COOKIE = "iba_last_seen";

/** Only rewrite the cookie when it is older than this, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export function idleLimitMs(): number {
  const days = Number(process.env.SESSION_IDLE_DAYS ?? 7);
  return (Number.isFinite(days) && days > 0 ? days : 7) * 86_400_000;
}

/** True when the last activity is known and older than the limit. Unknown means not idle. */
export function isIdleExpired(lastSeen: string | undefined, now: number, limitMs = idleLimitMs()): boolean {
  const seen = Number(lastSeen);
  if (!lastSeen || !Number.isFinite(seen)) return false;
  return now - seen > limitMs;
}

export function shouldTouch(lastSeen: string | undefined, now: number): boolean {
  const seen = Number(lastSeen);
  return !lastSeen || !Number.isFinite(seen) || now - seen > TOUCH_INTERVAL_MS;
}
