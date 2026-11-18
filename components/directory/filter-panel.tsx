import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ALUMNI_FIELDS, DEPARTMENTS, PROGRAMMES, maxBatch } from "@/lib/constants/academics";
import type { DirectoryQuery } from "@/lib/services/directory";

type Option = { value: string; label: string };

/**
 * Directory filters in the client's priority order (FR2.3, wireframe P06): course, skill,
 * available to advise, batch, department / programme, then alumni field and company.
 * A plain GET form, so filters live in the URL and work without JavaScript.
 */
export function FilterPanel({ query, courses, skills }: { query: DirectoryQuery; courses: Option[]; skills: string[] }) {
  const years = Array.from({ length: maxBatch() - 1990 + 1 }, (_, i) => maxBatch() - i);
  return (
    <form action="/directory" method="get" className="space-y-4" aria-label="Filters">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="f-course">1 · Course</Label>
        <NativeSelect id="f-course" name="course" defaultValue={query.course[0] ?? ""}>
          <option value="">Any course</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-skill">2 · Skill</Label>
        <NativeSelect id="f-skill" name="skill" defaultValue={query.skill[0] ?? ""}>
          <option value="">Any skill</option>
          {skills.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="advise" value="1" defaultChecked={query.advise} className="size-4 accent-[var(--primary)]" />
        3 · Available to advise
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="f-batch">4 · Batch</Label>
        <NativeSelect id="f-batch" name="batch" defaultValue={query.batch ? String(query.batch) : ""}>
          <option value="">Any batch</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-department">5 · Department</Label>
        <NativeSelect id="f-department" name="department" defaultValue={query.department ?? ""}>
          <option value="">Any department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-programme">Programme</Label>
        <NativeSelect id="f-programme" name="programme" defaultValue={query.programme ?? ""}>
          <option value="">Any programme</option>
          {PROGRAMMES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </NativeSelect>
      </div>

      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Alumni</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="alumni" value="1" defaultChecked={query.alumni} className="size-4 accent-[var(--primary)]" />
          Alumni only
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="f-field">Field</Label>
          <NativeSelect id="f-field" name="field" defaultValue={query.field ?? ""}>
            <option value="">Any field</option>
            {ALUMNI_FIELDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-company">Company</Label>
          <Input id="f-company" name="company" defaultValue={query.company ?? ""} maxLength={80} />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit">Apply filters</Button>
        <Link href={query.q ? `/directory?q=${encodeURIComponent(query.q)}` : "/directory"} className="text-sm text-muted-foreground underline">
          Clear all
        </Link>
      </div>
    </form>
  );
}
