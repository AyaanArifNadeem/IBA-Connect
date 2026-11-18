import "server-only";
import { z } from "zod";
import { ApiError, badRequest, conflict, notFound, rateLimited } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { getEmailSender } from "@/lib/email";
import { connectionRequestEmail } from "@/lib/email/templates";
import { visibleMembers } from "./directory";

/** FR3.1: about ten requests a day, and a wait before asking someone again after a decline. */
export const DAILY_REQUEST_LIMIT = 10;
export const DAY_MS = 86_400_000;
export const COOLDOWN_DAYS = 3;
export const NOTE_MAX = 300;

export const requestSchema = z.object({
  recipientId: z.uuid(),
  note: z.string().trim().min(1, "Say briefly why you are reaching out").max(NOTE_MAX, `The note can be at most ${NOTE_MAX} characters`),
});

/** Requests the member has sent in the last 24 hours, and how many remain. */
export async function requestAllowance(memberId: string, now = new Date()) {
  const used = await db.connection.count({
    where: { requesterId: memberId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
  });
  return { used, limit: DAILY_REQUEST_LIMIT, remaining: Math.max(0, DAILY_REQUEST_LIMIT - used) };
}

const between = (a: string, b: string) => ({
  OR: [
    { requesterId: a, recipientId: b },
    { requesterId: b, recipientId: a },
  ],
});

export type Relationship =
  | { state: "self" }
  | { state: "none" }
  | { state: "pending_outgoing"; connectionId: string }
  | { state: "pending_incoming"; connectionId: string }
  | { state: "connected"; connectionId: string }
  | { state: "cooldown"; until: Date }
  | { state: "blocked" };

/** Where two members stand, for the profile's Connect button (wireframe P07). */
export async function relationship(viewerId: string, otherId: string, now = new Date()): Promise<Relationship> {
  if (viewerId === otherId) return { state: "self" };
  const blocked = await db.block.findFirst({
    where: { OR: [{ blockerId: viewerId, blockedId: otherId }, { blockerId: otherId, blockedId: viewerId }] },
  });
  if (blocked) return { state: "blocked" };

  const active = await db.connection.findFirst({
    where: { ...between(viewerId, otherId), status: { in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED] } },
  });
  if (active?.status === ConnectionStatus.ACCEPTED) return { state: "connected", connectionId: active.id };
  if (active) {
    return active.requesterId === viewerId
      ? { state: "pending_outgoing", connectionId: active.id }
      : { state: "pending_incoming", connectionId: active.id };
  }

  const declined = await db.connection.findFirst({
    where: { requesterId: viewerId, recipientId: otherId, status: ConnectionStatus.DECLINED },
    orderBy: { respondedAt: "desc" },
  });
  if (declined?.respondedAt) {
    const until = new Date(declined.respondedAt.getTime() + COOLDOWN_DAYS * DAY_MS);
    if (until > now) return { state: "cooldown", until };
  }
  return { state: "none" };
}

/**
 * Send a connection request (FR3.1, US3.1, US3.2). Checks, in order: the recipient is a visible
 * member, nobody blocked anybody, no pending or accepted connection exists, the cooldown after a
 * decline has passed, and the daily limit. Then emails the recipient (FR3.6).
 */
export async function sendRequest(
  requester: { id: string; name: string },
  input: { recipientId: string; note: string; originPostId?: string | null },
  now = new Date(),
) {
  if (input.recipientId === requester.id) throw badRequest("You cannot send a request to yourself.");
  const recipient = await db.user.findFirst({
    where: { ...visibleMembers(requester.id), id: input.recipientId },
    select: { id: true, name: true, email: true },
  });
  if (!recipient) throw notFound("This member could not be found.");

  const rel = await relationship(requester.id, recipient.id, now);
  if (rel.state === "blocked") throw new ApiError(403, "forbidden", "You cannot send a request to this member.");
  if (rel.state === "connected") throw conflict("You are already connected.");
  if (rel.state === "pending_outgoing") throw conflict("You already sent a request to this member.");
  if (rel.state === "pending_incoming") throw conflict("This member already sent you a request. Answer it in Requests.");
  if (rel.state === "cooldown") {
    const days = Math.ceil((rel.until.getTime() - now.getTime()) / DAY_MS);
    throw rateLimited(`You asked this member recently. You can ask again in ${days} ${days === 1 ? "day" : "days"}.`, Math.ceil((rel.until.getTime() - now.getTime()) / 1000));
  }

  const allowance = await requestAllowance(requester.id, now);
  if (allowance.remaining === 0) {
    const oldest = await db.connection.findFirst({
      where: { requesterId: requester.id, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
      orderBy: { createdAt: "asc" },
    });
    const wait = oldest ? Math.ceil((oldest.createdAt.getTime() + DAY_MS - now.getTime()) / 1000) : 3600;
    throw rateLimited(`You can send up to ${DAILY_REQUEST_LIMIT} requests a day. Please try again later.`, wait);
  }

  let connection;
  try {
    connection = await db.connection.create({
      data: { requesterId: requester.id, recipientId: recipient.id, contextNote: input.note, originPostId: input.originPostId ?? null, createdAt: now },
    });
  } catch (err) {
    // Two requests at the same moment: the database allows only one (Connection_active_pair_key)
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") throw conflict("A request between you already exists.");
    throw err;
  }

  // Email the recipient; a failed email does not undo the request (FR3.6)
  try {
    await getEmailSender().send(connectionRequestEmail({ to: recipient, from: requester.name, note: input.note, appUrl: publicEnv().appUrl }));
  } catch (err) {
    console.warn("[email] connection request email failed", { reason: err instanceof Error ? err.message : "unknown" });
  }

  return { connection, remaining: allowance.remaining - 1 };
}

// ------------------------------------------------------------ accept, decline and inbox

/** FR3.2: only the recipient answers, and only while the request is pending. */
export async function respondToRequest(memberId: string, connectionId: string, action: "accept" | "decline") {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  // Requests between other members are reported as not found, so they cannot be discovered
  if (!connection || (connection.recipientId !== memberId && connection.requesterId !== memberId)) {
    throw notFound("Request not found.");
  }
  if (connection.recipientId !== memberId) throw new ApiError(403, "forbidden", "Only the person who received the request can answer it.");
  if (connection.status !== ConnectionStatus.PENDING) throw conflict("This request has already been answered.");

  const updated = await db.connection.updateMany({
    where: { id: connectionId, status: ConnectionStatus.PENDING },
    data: { status: action === "accept" ? ConnectionStatus.ACCEPTED : ConnectionStatus.DECLINED, respondedAt: new Date() },
  });
  if (updated.count !== 1) throw conflict("This request has already been answered.");
  return db.connection.findUniqueOrThrow({ where: { id: connectionId } });
}

export const INBOX_VIEWS = ["incoming", "outgoing", "accepted"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

const personSelect = { id: true, name: true, email: true, avatarPath: true, deletedAt: true } as const;

/** Requests inbox (FR3.3, US3.4): incoming pending, outgoing (pending and declined), accepted. */
export async function listRequests(memberId: string, view: InboxView, now = new Date()) {
  const where =
    view === "incoming"
      ? { recipientId: memberId, status: ConnectionStatus.PENDING }
      : view === "outgoing"
        ? { requesterId: memberId, status: { in: [ConnectionStatus.PENDING, ConnectionStatus.DECLINED] } }
        : { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: memberId }, { recipientId: memberId }] };

  const rows = await db.connection.findMany({
    where,
    include: {
      requester: { select: personSelect },
      recipient: { select: personSelect },
      originPost: { select: { id: true, title: true } },
    },
    orderBy: view === "accepted" ? { respondedAt: "desc" } : { createdAt: "desc" },
    take: 100,
  });

  return rows.map((c) => {
    const other = c.requesterId === memberId ? c.recipient : c.requester;
    const cooldownDays =
      c.status === ConnectionStatus.DECLINED && c.respondedAt
        ? Math.max(0, Math.ceil((c.respondedAt.getTime() + COOLDOWN_DAYS * DAY_MS - now.getTime()) / DAY_MS))
        : 0;
    return {
      id: c.id,
      status: c.status,
      note: c.contextNote,
      createdAt: c.createdAt.toISOString(),
      respondedAt: c.respondedAt?.toISOString() ?? null,
      person: { id: other.id, name: other.deletedAt ? "Deleted member" : other.name, avatarPath: other.avatarPath },
      // Email only for accepted connections (FR3.5)
      email: c.status === ConnectionStatus.ACCEPTED && !other.deletedAt ? other.email : null,
      viaPost: c.originPost,
      cooldownDays,
    };
  });
}

export type InboxItem = Awaited<ReturnType<typeof listRequests>>[number];

/** Counts for the inbox tabs and the menu badge (FR3.6). */
export async function inboxCounts(memberId: string) {
  const [incoming, outgoing, accepted] = await Promise.all([
    db.connection.count({ where: { recipientId: memberId, status: ConnectionStatus.PENDING } }),
    db.connection.count({ where: { requesterId: memberId, status: { in: [ConnectionStatus.PENDING, ConnectionStatus.DECLINED] } } }),
    db.connection.count({ where: { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: memberId }, { recipientId: memberId }] } }),
  ]);
  return { incoming, outgoing, accepted };
}
