import "server-only";
import { inboxCounts, listRequests } from "./connections";
import { listConversations } from "./messages";
import { listMyPosts } from "./posts";

const PREVIEW = 5;

/**
 * Everything the dashboard shows after sign-in (FR1.7, wireframe P04): pending requests,
 * unread messages, the member's open need posts, and the counts for the summary cards.
 */
export async function getDashboard(memberId: string) {
  const [counts, incoming, conversations, posts] = await Promise.all([
    inboxCounts(memberId),
    listRequests(memberId, "incoming"),
    listConversations(memberId),
    listMyPosts(memberId),
  ]);
  const unreadChats = conversations.filter((c) => c.unread > 0);
  const openPosts = posts.filter((p) => p.state === "open");

  return {
    counts: {
      pendingRequests: counts.incoming,
      unreadMessages: unreadChats.reduce((sum, c) => sum + c.unread, 0),
      openPosts: openPosts.length,
      connections: counts.accepted,
    },
    pendingRequests: incoming.slice(0, PREVIEW),
    unreadChats: unreadChats.slice(0, PREVIEW),
    openPosts: openPosts.slice(0, PREVIEW),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
