import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { ConnectionStatus, UserStatus } from "@/lib/generated/prisma/enums";
import { getEmailSender } from "@/lib/email";
import { connectionRequestEmail } from "@/lib/email/templates";

/**
 * Durable notification emails (FR3.6).
 *
 * A row is written in the same transaction as the connection it announces, so a saved request always
 * has its email queued, and the request no longer waits for Brevo. The queue is emptied
 *   1. right after the response, from the same serverless invocation (after()), and
 *   2. by GET /api/v1/internal/email-outbox, which a scheduled job calls to retry what failed.
 * Delivery is at least once: if the process dies between Brevo accepting a message and the row being
 * marked sent, the email is sent again on the next retry.
 */
export const OUTBOX_KIND = { connectionRequest: "connection_request" } as const;

export const MAX_ATTEMPTS = 8;
/** While one worker is sending a row, others leave it alone for this long. */
export const LEASE_MS = 2 * 60_000;
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 6 * 3_600_000;

/** Wait before attempt number `attempts + 1`: 1, 2, 4, ... minutes, at most six hours. */
export function retryDelayMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

/** The value to store on a new row so that it is due straight away whatever the clock skew. */
export const DUE_NOW = new Date(0);

export type DrainResult = { sent: number; retrying: number; failed: number; dropped: number };

/**
 * Send the emails that are due. Safe to run from several places at once: each row is claimed with a
 * conditional update, so only one worker sends it.
 */
export async function drainEmailOutbox({ limit = 10, now = new Date() }: { limit?: number; now?: Date } = {}): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, retrying: 0, failed: 0, dropped: 0 };
  const due = await db.emailOutbox.findMany({
    where: { sentAt: null, failedAt: null, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of due) {
    const claim = await db.emailOutbox.updateMany({
      where: { id, sentAt: null, failedAt: null, nextAttemptAt: { lte: now } },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claim.count !== 1) continue; // another worker has it

    const row = await db.emailOutbox.findUnique({
      where: { id },
      include: {
        connection: {
          include: {
            requester: { select: { name: true } },
            recipient: { select: { name: true, email: true, status: true, deletedAt: true } },
            originPost: { select: { title: true } },
          },
        },
      },
    });
    if (!row) continue;

    const { connection } = row;
    // Nothing to announce any more: answered already, or the recipient is gone
    if (connection.status !== ConnectionStatus.PENDING || connection.recipient.deletedAt || connection.recipient.status !== UserStatus.ACTIVE) {
      await db.emailOutbox.deleteMany({ where: { id } });
      result.dropped += 1;
      continue;
    }

    try {
      await getEmailSender().send(
        connectionRequestEmail({
          to: { email: connection.recipient.email, name: connection.recipient.name },
          from: connection.requester.name,
          note: connection.contextNote,
          appUrl: publicEnv().appUrl,
          postTitle: connection.originPost?.title ?? null,
        }),
      );
      await db.emailOutbox.update({ where: { id }, data: { sentAt: new Date() } });
      result.sent += 1;
    } catch (err) {
      // Never log the recipient or the message (NFR18)
      console.warn("[email] outbox delivery failed", { kind: row.kind, attempt: row.attempts, reason: err instanceof Error ? err.message : "unknown" });
      if (row.attempts >= MAX_ATTEMPTS) {
        await db.emailOutbox.update({ where: { id }, data: { failedAt: new Date() } });
        result.failed += 1;
      } else {
        await db.emailOutbox.update({ where: { id }, data: { nextAttemptAt: new Date(Date.now() + retryDelayMs(row.attempts)) } });
        result.retrying += 1;
      }
    }
  }
  return result;
}

/**
 * Empty the queue once the response has gone out. Outside a request (scripts, tests) there is no
 * "after", so it runs straight away and the caller can await it.
 */
export function scheduleOutboxDrain(): Promise<void> | undefined {
  const run = async () => {
    try {
      await drainEmailOutbox();
    } catch (err) {
      console.warn("[email] outbox drain failed", { reason: err instanceof Error ? err.message : "unknown" });
    }
  };
  try {
    after(run);
    return undefined;
  } catch {
    return run();
  }
}
