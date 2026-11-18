import type { Metadata } from "next";
import { ConversationList } from "@/components/messages/conversation-list";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { listConversations } from "@/lib/services/messages";
import { avatarUrls } from "@/lib/storage/avatars";

export const metadata: Metadata = { title: "Messages · IBA Connect" };

/** Chats list (FR3.4, wireframe P09). On wide screens a hint fills the thread area. */
export default async function MessagesPage() {
  const member = await requireCompletedProfile();
  const conversations = await listConversations(member.id);
  const avatars = await avatarUrls(conversations.map((c) => c.avatarPath));

  return (
    <div className="grid overflow-hidden rounded-xl border bg-background md:grid-cols-[18rem_1fr]">
      <div className="md:border-r">
        <h1 className="border-b px-3 py-3 text-lg font-bold">Chats</h1>
        <ConversationList conversations={conversations} avatars={avatars} />
      </div>
      <div className="hidden items-center justify-center p-8 text-sm text-muted-foreground md:flex">
        Choose a chat to start messaging.
      </div>
    </div>
  );
}
