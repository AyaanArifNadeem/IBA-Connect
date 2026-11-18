import Link from "next/link";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, and two either side of the current page. */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Link-based pager that keeps the other query parameters (search, filters). */
export function Pager({ page, pages, params }: { page: number; pages: number; params: URLSearchParams }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params);
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  };
  const item = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm";

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "hover:bg-muted")} rel="prev">
          ‹ Prev
        </Link>
      ) : null}
      {pageWindow(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(item, "hover:bg-muted")} rel="next">
          Next ›
        </Link>
      ) : null}
    </nav>
  );
}
