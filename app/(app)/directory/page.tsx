import type { Metadata } from "next";
import Link from "next/link";
import { MemberCard } from "@/components/directory/member-card";
import { Pager } from "@/components/directory/pager";
import { SearchBox } from "@/components/directory/search-box";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { directoryQuerySchema, listMembers } from "@/lib/services/directory";

export const metadata: Metadata = { title: "Directory · IBA Connect" };

/** Member directory (FR2.1, US2.1, wireframe P06). */
export default async function DirectoryPage({ searchParams }: PageProps<"/directory">) {
  const member = await requireCompletedProfile();
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
  );
  const parsed = directoryQuerySchema.safeParse(Object.fromEntries(params));
  const query = parsed.success ? parsed.data : { page: 1 };
  const result = await listMembers(member.id, query);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Directory</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {result.total} {result.total === 1 ? "member" : "members"}
          {query.q ? ` for “${query.q}”` : ""}
        </p>
      </div>

      <SearchBox q={query.q} keep={[...params.entries()].filter(([k]) => k !== "q" && k !== "page")} />
      {!parsed.success ? (
        <p role="alert" className="text-sm text-destructive">
          {parsed.error.issues[0]?.message ?? "Some search options were not valid and were ignored."}
        </p>
      ) : null}

      {result.members.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.members.map((m) => (
            <li key={m.id}>
              <MemberCard member={m} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {query.q ? `No members found for “${query.q}”. Try another word, or ` : "No one matches. "}
          <Link href="/board" className="font-medium text-primary underline">
            post on the Need Board
          </Link>
          .
        </div>
      )}

      <Pager page={result.page} pages={result.pages} params={params} />
    </div>
  );
}
