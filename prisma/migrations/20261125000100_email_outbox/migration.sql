-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "connectionId" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOutbox_sentAt_failedAt_nextAttemptAt_idx" ON "EmailOutbox"("sentAt", "failedAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_kind_connectionId_key" ON "EmailOutbox"("kind", "connectionId");

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (NFR7, SRS 6.4): same treatment as every other table (see the init migration).
-- The outbox is only ever read and written by server-side code; the public API roles get nothing.
ALTER TABLE "EmailOutbox" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "EmailOutbox" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "EmailOutbox" FROM authenticated;
  END IF;
END $$;
