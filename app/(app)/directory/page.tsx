import type { Metadata } from "next";
import Link from "next/link";
import { ActiveFilters } from "@/components/directory/active-filters";
import { FilterPanel } from "@/components/directory/filter-panel";
import { FilterToggle } from "@/components/directory/filter-toggle";
import { MemberCard } from "@/components/directory/member-card";
import { Pager } from "@/components/directory/pager";
import { SearchBox } from "@/components/directory/search-box";
import { paramsToObject } from "@/lib/api/validation";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { activeFilterCount, directoryQuerySchema, listMembers } from "@/lib/services/directory";
import { listCourses, suggestSkills } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Directory · IBA Connect" };

/** Member directory with search and filters (FR2.1–FR2.3, wireframes P06 and P21). */
export default async function DirectoryPage({ searchParams }: PageProps<"/directory">) {
  const member = await requireCompletedProfile();
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
  );
  const parsed = directoryQuerySchema.safeParse(paramsToObject(params));
  const query = parsed.success ? parsed.data : directoryQuerySchema.parse({});
  const [result, courses, skills] = await Promise.all([listMembers(member.id, query), listCourses(), suggestSkills()]);
  const filtered = activeFilterCount(query) > 0 || Boolean(query.q);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Directory</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {result.total} {result.total === 1 ? "member" : "members"}
          {query.q ? ` for “${query.q}”` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[15rem_1fr]">
        <aside>
          <FilterToggle count={activeFilterCount(query)}>
            <FilterPanel
              query={query}
              courses={courses.map((c) => ({ value: c.code, label: `${c.code} · ${c.title}` }))}
              skills={skills.map((s) => s.name)}
            />
          </FilterToggle>
        </aside>

        <div className="min-w-0 space-y-4">
          <SearchBox q={query.q} keep={[...params.entries()].filter(([k]) => k !== "q" && k !== "page")} />
          <ActiveFilters params={params} />
          {!parsed.success ? (
            <p role="alert" className="text-sm text-destructive">
              {parsed.error.issues[0]?.message ?? "Some filters were not valid and were ignored."}
            </p>
          ) : null}

          {result.members.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.members.map((m) => (
                <li key={m.id} className="min-w-0">
                  <MemberCard member={m} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {filtered ? (
                <>
                  <p className="font-medium text-foreground">No members found.</p>
                  <p className="mt-1">
                    <Link href="/directory" className="font-medium text-primary underline">
                      Clear the search and filters
                    </Link>{" "}
                    or{" "}
                    <Link href="/board" className="font-medium text-primary underline">
                      post on the Need Board
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  No one is here yet.{" "}
                  <Link href="/board" className="font-medium text-primary underline">
                    Post on the Need Board
                  </Link>
                  .
                </>
              )}
            </div>
          )}

          <Pager page={result.page} pages={result.pages} params={params} />
        </div>
      </div>
    </div>
  );
}
