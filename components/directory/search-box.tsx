import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Directory search (FR2.2, wireframe P06). A plain GET form: works without JavaScript, and the
 * search ends up in the URL so it can be shared and survives paging. Other filters are kept.
 */
export function SearchBox({ q, keep }: { q?: string; keep: [string, string][] }) {
  return (
    <form action="/directory" method="get" role="search" className="flex gap-2">
      {keep.map(([name, value], i) => (
        <input key={`${name}-${i}`} type="hidden" name={name} value={value} />
      ))}
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          defaultValue={q}
          maxLength={100}
          placeholder="Search name, skill or course…"
          aria-label="Search members by name, skill or course"
          className="pl-8"
        />
      </div>
      <Button type="submit">Search</Button>
      {q ? (
        <Link
          href={keep.length ? `/directory?${new URLSearchParams(keep).toString()}` : "/directory"}
          className="inline-flex items-center px-2 text-sm text-muted-foreground underline"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}
