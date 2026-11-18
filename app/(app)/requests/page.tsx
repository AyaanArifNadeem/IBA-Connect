import type { Metadata } from "next";
import Link from "next/link";
import { InboxRow } from "@/components/requests/inbox-row";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { INBOX_VIEWS, type InboxView, inboxCounts, listRequests } from "@/lib/services/connections";
import { avatarUrls } from "@/lib/storage/avatars";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Requests · IBA Connect" };

const LABELS: Record<InboxView, string> = { incoming: "Incoming", outgoing: "Outgoing", accepted: "Accepted" };
const EMPTY: Record<InboxView, string> = {
  incoming: "No requests waiting for you.",
  outgoing: "You have not sent any requests. Find someone in the directory.",
  accepted: "No connections yet. Accepted requests appear here.",
};

/** Requests inbox (FR3.3, US3.4, wireframe P08). */
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const member = await requireCompletedProfile();
  const { view: rawView } = await searchParams;
  const view: InboxView = INBOX_VIEWS.includes(rawView as InboxView) ? (rawView as InboxView) : "incoming";

  const [items, counts] = await Promise.all([listRequests(member.id, view), inboxCounts(member.id)]);
  const urls = await avatarUrls(items.map((i) => i.person.avatarPath));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Connection requests</h1>

      <nav aria-label="Request lists" className="flex gap-1 border-b">
        {INBOX_VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "incoming" ? "/requests" : `/requests?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              v === view ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[v]} ({counts[v]})
          </Link>
        ))}
      </nav>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <InboxRow item={item} view={view} avatarUrl={item.person.avatarPath ? (urls.get(item.person.avatarPath) ?? null) : null} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {EMPTY[view]}{" "}
          {view === "outgoing" ? (
            <Link href="/directory" className="font-medium text-primary underline">
              Open the directory
            </Link>
          ) : null}
        </p>
      )}
    </div>
  );
}
