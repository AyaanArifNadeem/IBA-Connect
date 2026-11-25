import type { PoolConfig } from "pg";

/**
 * Connection pool settings for the runtime database client (lib/db.ts).
 *
 * The defaults are the values the app already ran with (10 s to connect, TCP keep-alive on, the pg
 * default pool size of 10) plus a 20 s client-side query timeout so that a stuck query fails
 * instead of holding a request open. Each can be overridden per deployment without a code change:
 *
 *   DATABASE_POOL_MAX            connections per server instance (pg default 10). Every serverless
 *                                instance has its own pool: instances x this value must stay below
 *                                the pooler's client limit.
 *   DATABASE_IDLE_TIMEOUT_MS     close idle connections after this long (pg default 10 000)
 *   DATABASE_CONNECT_TIMEOUT_MS  give up connecting after this long (default 10 000)
 *   DATABASE_QUERY_TIMEOUT_MS    give up on a query after this long (default 20 000, 0 = never)
 *
 * Measure before changing them (docs/setup/database-latency.md).
 */
export function poolConfig(connectionString: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  const number = (name: string, fallback: number | undefined, { min = 0 }: { min?: number } = {}) => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min ? value : fallback;
  };

  const config: PoolConfig = {
    connectionString,
    connectionTimeoutMillis: number("DATABASE_CONNECT_TIMEOUT_MS", 10_000, { min: 1 }),
    keepAlive: true,
  };
  const max = number("DATABASE_POOL_MAX", undefined, { min: 1 });
  if (max !== undefined) config.max = max;
  const idle = number("DATABASE_IDLE_TIMEOUT_MS", undefined);
  if (idle !== undefined) config.idleTimeoutMillis = idle;
  const queryTimeout = number("DATABASE_QUERY_TIMEOUT_MS", 20_000);
  if (queryTimeout) config.query_timeout = queryTimeout;
  return config;
}

/**
 * A warning when DATABASE_URL does not look like the Supabase *transaction* pooler that
 * docs/setup/supabase.md asks for at runtime (a direct connection, or the session pooler on 5432,
 * holds a database connection per serverless instance). Returns null when it looks right or cannot
 * tell. Never includes the user, password or full host.
 */
export function databaseUrlWarning(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return null;
  }
  const port = url.port || "5432";
  const supabase = url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.com");
  if (!supabase) return null;
  if (url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")) {
    return `DATABASE_URL points at a direct Supabase connection (port ${port}). Use the transaction pooler (port 6543) at runtime and keep the direct URL in DIRECT_URL.`;
  }
  if (port === "5432") {
    return "DATABASE_URL uses port 5432 on a Supabase pooler host, which is session mode. Use the transaction pooler (port 6543) at runtime and keep the session/direct URL in DIRECT_URL.";
  }
  return null;
}
