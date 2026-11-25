-- Rate limiter in one round trip (NFR20).
--
-- The application used to run a SELECT, then an INSERT, then (2% of the time) a DELETE for every
-- limited request, and two simultaneous requests could both pass the check. This function does the
-- check and the insert together. Each statement inside a PL/pgSQL function takes a fresh snapshot,
-- so after the per-key advisory lock is acquired the count sees every hit committed before it:
-- requests for the same key are serialised, requests for other keys are not affected.
--
-- Parameters are timestamptz so that the caller can pass ISO strings in UTC; the table column is
-- TIMESTAMP(3) holding UTC, as written by Prisma.

CREATE OR REPLACE FUNCTION "rate_limit_hit"(
    p_key     TEXT,
    p_user_id UUID,
    p_since   TIMESTAMPTZ,
    p_now     TIMESTAMPTZ,
    p_limit   INTEGER,
    p_id      UUID
) RETURNS TABLE ("allowed" BOOLEAN, "oldest_ms" DOUBLE PRECISION)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count  INTEGER;
    v_oldest TIMESTAMP;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));

    SELECT count(*), min("createdAt")
      INTO v_count, v_oldest
      FROM "RateLimitHit"
     WHERE "key" = p_key
       AND "createdAt" > (p_since AT TIME ZONE 'UTC');

    IF v_count >= p_limit THEN
        -- Epoch milliseconds: independent of the session time zone and of how the driver reads timestamps
        RETURN QUERY SELECT FALSE, (extract(epoch FROM (v_oldest AT TIME ZONE 'UTC')) * 1000)::DOUBLE PRECISION;
        RETURN;
    END IF;

    INSERT INTO "RateLimitHit" ("id", "key", "userId", "createdAt")
    VALUES (p_id, p_key, p_user_id, (p_now AT TIME ZONE 'UTC'));

    RETURN QUERY SELECT TRUE, NULL::DOUBLE PRECISION;
END;
$$;

-- Supabase exposes functions in the public schema through its REST API (/rpc). This one is only for
-- the server-side application (the database owner), never for the anon/authenticated API roles.
REVOKE ALL ON FUNCTION "rate_limit_hit"(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION "rate_limit_hit"(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION "rate_limit_hit"(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) FROM authenticated;
  END IF;
END $$;
