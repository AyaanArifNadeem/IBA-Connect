import "server-only";
import { z } from "zod";
import { ApiError, notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { ConnectionStatus } from "@/lib/generated/prisma/enums";
import { enforceRateLimit } from "@/lib/rate-limit";

export const MESSAGE_MAX = 2000;
/** How often an open chat asks for new messages (FR3.8: polling). */
export const POLL_INTERVAL_MS = 5000;

export const messageSchema = z.object({
  body: z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().min(1, "Write a message first").max(MESSAGE_MAX, `A message can be at most ${MESSAGE_MAX.toLocaleString("en")} characters`)),
});

/**
 * The conversation behind a connection (FR3.4). Only the two members can open it (others get
 * 404, so it cannot be discovered), and only once the request has been accepted.
 */
export async function getConversation(memberId: string, connectionId: string) {
  const c = await db.connection.findUnique({
    where: { id: connectionId },
    include: {
      requester: { select: { id: true, name: true, email: true, avatarPath: true, deletedAt: true } },
      recipient: { select: { id: true, name: true, email: true, avatarPath: true, deletedAt: true } },
      originPost: { select: { id: true, title: true } },
    },
  });
  if (!c || (c.requesterId !== memberId && c.recipientId !== memberId)) throw notFound("Conversation not found.");
  if (c.status !== ConnectionStatus.ACCEPTED) {
    throw new ApiError(403, "forbidden", "You can message each other once the connection request is accepted.");
  }
  const other = c.requesterId === memberId ? c.recipient : c.requester;
  return {
    id: c.id,
    note: c.contextNote,
    requestedByMe: c.requesterId === memberId,
    viaPost: c.originPost,
    other: {
      id: other.id,
      name: other.deletedAt ? "Deleted member" : other.name,
      email: other.deletedAt ? null : other.email,
      avatarPath: other.deletedAt ? null : other.avatarPath,
      deleted: Boolean(other.deletedAt),
    },
  };
}

export type ChatMessage = { id: string; body: string; sentAt: string; mine: boolean; readAt: string | null };

/** Messages in order; with `after`, only newer ones (for polling). The latest 200 otherwise. */
export async function listMessages(memberId: string, connectionId: string, after?: Date): Promise<ChatMessage[]> {
  await getConversation(memberId, connectionId);
  const rows = after
    ? await db.message.findMany({ where: { connectionId, sentAt: { gt: after } }, orderBy: [{ sentAt: "asc" }, { id: "asc" }], take: 200 })
    : (await db.message.findMany({ where: { connectionId }, orderBy: [{ sentAt: "desc" }, { id: "desc" }], take: 200 })).reverse();
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    sentAt: m.sentAt.toISOString(),
    mine: m.senderId === memberId,
    readAt: m.readAt?.toISOString() ?? null,
  }));
}

/** Send a text message (FR3.4, FR3.8). Refused without an accepted connection or when blocked (FR3.7). */
export async function sendMessage(memberId: string, connectionId: string, body: string): Promise<ChatMessage> {
  const conversation = await getConversation(memberId, connectionId);
  if (conversation.other.deleted) throw new ApiError(403, "forbidden", "This member has left IBA Connect.");
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: memberId, blockedId: conversation.other.id },
        { blockerId: conversation.other.id, blockedId: memberId },
      ],
    },
  });
  if (blocked) throw new ApiError(403, "forbidden", "You cannot message this member.");

  await enforceRateLimit({ key: `message:${memberId}`, limit: 30, windowMs: 60_000, userId: memberId, message: "You are sending messages too quickly. Please wait a moment." });
  const m = await db.message.create({ data: { connectionId, senderId: memberId, body } });
  return { id: m.id, body: m.body, sentAt: m.sentAt.toISOString(), mine: true, readAt: null };
}

/** The member's conversations, most recent activity first, with the last message (P09 list). */
export async function listConversations(memberId: string) {
  const unread = await unreadByConversation(memberId);
  const connections = await db.connection.findMany({
    where: { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: memberId }, { recipientId: memberId }] },
    include: {
      requester: { select: { id: true, name: true, avatarPath: true, deletedAt: true } },
      recipient: { select: { id: true, name: true, avatarPath: true, deletedAt: true } },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });
  return connections
    .map((c) => {
      const other = c.requesterId === memberId ? c.recipient : c.requester;
      const last = c.messages[0];
      return {
        id: c.id,
        name: other.deletedAt ? "Deleted member" : other.name,
        avatarPath: other.deletedAt ? null : other.avatarPath,
        lastMessage: last ? { preview: last.body.slice(0, 80), sentAt: last.sentAt.toISOString(), mine: last.senderId === memberId } : null,
        unread: unread.get(c.id) ?? 0,
        activity: (last?.sentAt ?? c.respondedAt ?? c.createdAt).getTime(),
      };
    })
    .sort((a, b) => b.activity - a.activity);
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

// ------------------------------------------------------------------ unread (US3.6)

/** Mark the other member's messages in this chat as read (opening the chat, FR3.4). */
export async function markRead(memberId: string, connectionId: string, now = new Date()) {
  const result = await db.message.updateMany({
    where: { connectionId, senderId: { not: memberId }, readAt: null, connection: { OR: [{ requesterId: memberId }, { recipientId: memberId }] } },
    data: { readAt: now },
  });
  return result.count;
}

/** Unread messages per chat, for accepted connections only. */
export async function unreadByConversation(memberId: string): Promise<Map<string, number>> {
  const rows = await db.message.groupBy({
    by: ["connectionId"],
    where: {
      senderId: { not: memberId },
      readAt: null,
      connection: { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: memberId }, { recipientId: memberId }] },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.connectionId, r._count._all]));
}

/** Total unread messages, for the Messages badge in the menu (FR3.6). */
export async function unreadTotal(memberId: string): Promise<number> {
  return db.message.count({
    where: {
      senderId: { not: memberId },
      readAt: null,
      connection: { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: memberId }, { recipientId: memberId }] },
    },
  });
}
