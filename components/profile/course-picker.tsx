"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_COURSES } from "@/lib/validation/profile";

export type CourseOption = { id: string; code: string; title: string; department: string };

type Props = {
  courses: CourseOption[];
  value: string[];
  onChange: (courseIds: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

/** Courses taken: pick from the course list (grouped by department), shown as removable chips. */
export function CoursePicker({ courses, value, onChange, invalid, describedBy }: Props) {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const available = courses.filter((c) => !value.includes(c.id));
  const departments = [...new Set(available.map((c) => c.department))].sort();

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Courses you have taken">
          {value.map((id) => {
            const course = byId.get(id);
            if (!course) return null;
            return (
              <li key={id}>
                <Badge variant="outline" className="gap-1 pr-1">
                  {course.code}
                  <span className="hidden text-muted-foreground sm:inline">{course.title}</span>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== id))}
                    className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`Remove ${course.code}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}
      <NativeSelect
        id="courses"
        value=""
        disabled={value.length >= MAX_COURSES || available.length === 0}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
      >
        <option value="">Add a course you have taken…</option>
        {departments.map((dept) => (
          <optgroup key={dept} label={dept}>
            {available
              .filter((c) => c.department === dept)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
          </optgroup>
        ))}
      </NativeSelect>
    </div>
  );
}
