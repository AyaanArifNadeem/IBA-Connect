import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/messages/chat-thread";
import { ConversationList } from "@/components/messages/conversation-list";
import { ApiError } from "@/lib/api/errors";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { POLL_INTERVAL_MS, getConversation, listConversations, listMessages, markRead } from "@/lib/services/messages";
import { avatarUrls } from "@/lib/storage/avatars";

export const metadata: Metadata = { title: "Chat · IBA Connect" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A private chat (FR3.4, US3.5, wireframe P09). */
export default async function ChatPage({ params }: PageProps<"/messages/[id]">) {
  const member = await requireCompletedProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let conversation;
  try {
    conversation = await getConversation(member.id, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="mx-auto max-w-md space-y-3 py-10 text-center">
          <h1 className="text-xl font-bold">Not connected yet</h1>
          <p className="text-muted-foreground">{err.message}</p>
          <Link href="/requests" className="text-sm font-medium text-primary underline">
            Go to your requests
          </Link>
        </div>
      );
    }
    throw err;
  }

  const messages = await listMessages(member.id, id);
  await markRead(member.id, id); // opening the chat reads it (US3.6)
  const conversations = await listConversations(member.id);
  const avatars = await avatarUrls([conversation.other.avatarPath, ...conversations.map((c) => c.avatarPath)]);

  return (
    <div className="grid overflow-hidden rounded-xl border bg-background md:grid-cols-[18rem_1fr]">
      <div className="hidden max-h-[calc(100dvh-8.5rem)] overflow-y-auto border-r md:block">
        <h2 className="border-b px-3 py-3 text-lg font-bold">Chats</h2>
        <ConversationList conversations={conversations} activeId={id} avatars={avatars} />
      </div>
      <ChatThread
        connectionId={id}
        note={conversation.note}
        requestedByMe={conversation.requestedByMe}
        initialMessages={messages}
        pollMs={POLL_INTERVAL_MS}
        other={{
          ...conversation.other,
          avatarUrl: conversation.other.avatarPath ? (avatars.get(conversation.other.avatarPath) ?? null) : null,
        }}
      />
    </div>
  );
}
