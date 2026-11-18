import { X } from "lucide-react";
import Link from "next/link";

/** Chips for the filters in use; each removes its own filter and keeps the rest (wireframe P06). */
export function ActiveFilters({ params }: { params: URLSearchParams }) {
  const chips: { label: string; href: string }[] = [];
  const labels: Record<string, (v: string) => string> = {
    course: (v) => v,
    skill: (v) => v,
    advise: () => "Advisers",
    batch: (v) => `Batch ${v}`,
    department: (v) => v,
    programme: (v) => v,
    alumni: () => "Alumni",
    field: (v) => v,
    company: (v) => `Company: ${v}`,
  };
  for (const [key, value] of params) {
    if (!labels[key] || !value) continue;
    const next = new URLSearchParams(params);
    next.delete("page");
    const remaining = next.getAll(key).filter((v) => v !== value);
    next.delete(key);
    remaining.forEach((v) => next.append(key, v));
    const qs = next.toString();
    chips.push({ label: labels[key](value), href: qs ? `/directory?${qs}` : "/directory" });
  }
  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Filters in use">
      {chips.map((c) => (
        <li key={c.label}>
          <Link
            href={c.href}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90"
          >
            {c.label}
            <X aria-hidden className="size-3" />
            <span className="sr-only">(remove filter)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
