"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { postJson, requestJson } from "@/lib/client/api";
import { DEPARTMENTS } from "@/lib/constants/academics";

export type CourseRow = { id: string; code: string; title: string; department: string; retired: boolean; members: number };

const empty = { code: "", title: "", department: "" };

/** Add, edit, retire and restore courses (FR1.10). */
export function CoursesPanel({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const showErrors = (error: { message: string; details?: unknown }) => {
    const details = error.details as { path: string; message: string }[] | undefined;
    if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
    else setErrors({ form: error.message });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    const result = editing
      ? await requestJson("PATCH", `/api/v1/admin/courses/${editing}`, form)
      : await postJson("/api/v1/admin/courses", form);
    setBusy(false);
    if (!result.ok) return showErrors(result.error);
    toast.success(editing ? "Course updated" : "Course added");
    setForm(empty);
    setEditing(null);
    router.refresh();
  }

  async function setRetired(c: CourseRow, retired: boolean) {
    const result = await requestJson("PATCH", `/api/v1/admin/courses/${c.id}`, { retired });
    if (!result.ok) return toast.error(result.error.message);
    toast.success(retired ? `${c.code} retired` : `${c.code} restored`);
    router.refresh();
  }

  const shown = courses.filter((c) => `${c.code} ${c.title} ${c.department}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit course" : "Add a course"}</CardTitle>
          <CardDescription>Courses members can add to their profiles and tag on the Need Board.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-code">Code</Label>
              <Input id="course-code" value={form.code} placeholder="CSE341" aria-invalid={Boolean(errors.code)} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              {errors.code ? <p className="text-sm text-destructive">{errors.code}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-title">Title</Label>
              <Input id="course-title" value={form.title} aria-invalid={Boolean(errors.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {errors.title ? <p className="text-sm text-destructive">{errors.title}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-department">Department</Label>
              <NativeSelect id="course-department" value={form.department} aria-invalid={Boolean(errors.department)} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Choose…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </NativeSelect>
              {errors.department ? <p className="text-sm text-destructive">{errors.department}</p> : null}
            </div>
            {errors.form ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.form}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {editing ? "Save" : "Add course"}
              </Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={() => (setEditing(null), setForm(empty), setErrors({}))}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course list</CardTitle>
          <CardDescription>
            {courses.filter((c) => !c.retired).length} active, {courses.filter((c) => c.retired).length} retired. Retired
            courses stay on profiles that already list them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input aria-label="Filter courses" placeholder="Filter by code, title or department" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Members</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className={`border-b last:border-0 ${c.retired ? "text-muted-foreground" : ""}`}>
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {c.code} {c.retired ? <Badge variant="outline">retired</Badge> : null}
                    </td>
                    <td className="py-2 pr-3">
                      {c.title}
                      <span className="block text-xs text-muted-foreground">{c.department}</span>
                    </td>
                    <td className="py-2 pr-3">{c.members}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c.id);
                          setForm({ code: c.code, title: c.title, department: c.department });
                          setErrors({});
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRetired(c, !c.retired)}>
                        {c.retired ? "Restore" : "Retire"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
