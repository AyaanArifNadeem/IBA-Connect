import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { POST_TYPE_LABELS, POST_TYPE_SLUGS, POST_TYPES, type PostTypeValue } from "@/lib/board";
import { DEPARTMENTS } from "@/lib/constants/academics";
import { cn } from "@/lib/utils";

type Props = {
  type?: PostTypeValue;
  course?: string;
  department?: string;
  q?: string;
  courses: { code: string; title: string }[];
};

/** Board filters (FR4.2, wireframe P10): the 4 types as chips, course, department and search. */
export function BoardFilters({ type, course, department, q, courses }: Props) {
  const withType = (t?: PostTypeValue) => {
    const params = new URLSearchParams();
    if (t) params.set("type", POST_TYPE_SLUGS[t]);
    if (course) params.set("course", course);
    if (department) params.set("department", department);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/board?${qs}` : "/board";
  };
  const chip = "rounded-full border px-3 py-1 text-sm whitespace-nowrap";

  return (
    <div className="space-y-3">
      <nav aria-label="Post types" className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={withType()} aria-current={!type ? "true" : undefined} className={cn(chip, !type ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
          All
        </Link>
        {POST_TYPES.map((t) => (
          <Link
            key={t}
            href={withType(t)}
            aria-current={type === t ? "true" : undefined}
            className={cn(chip, type === t ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
          >
            {POST_TYPE_LABELS[t]}
          </Link>
        ))}
      </nav>

      <form action="/board" method="get" className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
        {type ? <input type="hidden" name="type" value={POST_TYPE_SLUGS[type]} /> : null}
        <NativeSelect name="course" defaultValue={course ?? ""} aria-label="Course tag">
          <option value="">Any course</option>
          {courses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.title}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="department" defaultValue={department ?? ""} aria-label="Department tag">
          <option value="">Any department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </NativeSelect>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={q} maxLength={100} placeholder="Search posts" aria-label="Search posts" className="pl-8" />
        </div>
        <Button type="submit">Filter</Button>
      </form>
    </div>
  );
}
