"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BODY_MAX, POST_LIFETIME_DAYS, POST_TYPE_LABELS, POST_TYPES, TITLE_MAX, type PostTypeValue } from "@/lib/board";
import { requestJson } from "@/lib/client/api";
import { DEPARTMENTS } from "@/lib/constants/academics";
import { cn } from "@/lib/utils";

export type PostFormValues = { type: PostTypeValue | ""; title: string; body: string; course: string; department: string };
type Field = keyof PostFormValues;

type Props = {
  courses: { code: string; title: string }[];
  initial?: PostFormValues;
  /** Edit an existing post (US4.5): the type cannot change and the button says Save */
  postId?: string;
};

const EMPTY: PostFormValues = { type: "", title: "", body: "", course: "", department: "" };

/** Post a need / edit post (FR4.1, FR4.5, wireframe P11-A). */
export function PostForm({ courses, initial = EMPTY, postId }: Props) {
  const router = useRouter();
  const editing = Boolean(postId);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends Field>(field: K, value: PostFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing: Partial<Record<Field, string>> = {};
    if (!values.type) missing.type = "Choose the kind of help you need";
    if (values.title.trim().length < 3) missing.title = "Give your post a title";
    if (!values.body.trim()) missing.body = "Add some details";
    if (values.course && values.department) missing.department = "Tag a course or a department, not both";
    setErrors(missing);
    if (Object.keys(missing).length) return;

    setSaving(true);
    const payload = { title: values.title, body: values.body, course: values.course || null, department: values.department || null };
    const result = editing
      ? await requestJson<{ id: string }>("PATCH", `/api/v1/posts/${postId}`, payload)
      : await requestJson<{ id: string }>("POST", "/api/v1/posts", { ...payload, type: values.type });
    setSaving(false);

    if (!result.ok) {
      const details = result.error.details as { path: string; message: string }[] | undefined;
      if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
      else setFormError(result.error.message);
      return;
    }
    toast.success(editing ? "Post updated" : "Your post is on the board");
    router.push(editing ? `/board/my-posts/${postId}` : "/board");
    router.refresh();
  }

  const error = (field: Field) =>
    errors[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: Field) => ({ "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `${field}-error` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset aria-describedby={errors.type ? "type-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {POST_TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                values.type === t && "border-primary bg-primary/5",
                editing && values.type !== t && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="type" value={t} checked={values.type === t} disabled={editing} onChange={() => set("type", t)} className="accent-[var(--primary)]" />
              {POST_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        {error("type")}
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="post-title">Title</Label>
          <span className="text-xs text-muted-foreground">
            {values.title.length}/{TITLE_MAX}
          </span>
        </div>
        <Input id="post-title" value={values.title} maxLength={TITLE_MAX} onChange={(e) => set("title", e.target.value)} placeholder="e.g. CSE341 study partner before mids" {...a11y("title")} />
        {error("title")}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="post-body">Details</Label>
          <span className={cn("text-xs", values.body.length > BODY_MAX ? "text-destructive" : "text-muted-foreground")}>
            {values.body.length}/{BODY_MAX}
          </span>
        </div>
        <Textarea id="post-body" rows={6} value={values.body} onChange={(e) => set("body", e.target.value)} placeholder="What do you need, when, and who would be a good fit?" {...a11y("body")} />
        {error("body")}
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="post-course">Course tag (optional)</Label>
          <NativeSelect id="post-course" value={values.course} onChange={(e) => set("course", e.target.value)} {...a11y("course")}>
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="pb-2 text-center text-sm text-muted-foreground">or</span>
        <div className="space-y-1.5">
          <Label htmlFor="post-department">Department tag (optional)</Label>
          <NativeSelect id="post-department" value={values.department} onChange={(e) => set("department", e.target.value)} {...a11y("department")}>
            <option value="">No department</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error("course")}
      {error("department")}

      {!editing ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Visible to all verified members. Closes automatically in {POST_LIFETIME_DAYS} days.
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save" : "Publish"}
        </Button>
      </div>
    </form>
  );
}
