"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/client/api";
import { ALUMNI_FIELDS, DEPARTMENTS, MAX_SEMESTER, PROGRAMMES, maxBatch } from "@/lib/constants/academics";
import { BIO_MAX } from "@/lib/validation/profile";
import { CoursePicker, type CourseOption } from "./course-picker";
import { SkillsInput } from "./skills-input";

export type ProfileFormValues = {
  name: string;
  batch: string;
  programme: string;
  department: string;
  semester: string;
  bio: string;
  skills: string[];
  courseIds: string[];
  /** Alumni only (US1.7) */
  field: string;
  company: string;
};

type Field = keyof ProfileFormValues;

type Props = {
  initial: ProfileFormValues;
  courses: CourseOption[];
  isAlumnus: boolean;
  submitLabel: string;
  /** Where to go after saving */
  redirectTo: string;
};

const BATCH_FLOOR = 1990;

/** Profile form used for first-time setup (US1.5) and editing (US1.6). Wireframe P03. */
export function ProfileForm({ initial, courses, isAlumnus, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends Field>(field: K, value: ProfileFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function checkRequired(): boolean {
    const missing: Partial<Record<Field, string>> = {};
    if (values.name.trim().length < 2) missing.name = "Enter your full name";
    if (!values.batch) missing.batch = "Choose your batch";
    if (!values.programme) missing.programme = "Choose your programme";
    if (!values.department) missing.department = "Choose your department";
    if (!isAlumnus && !values.semester) missing.semester = "Choose your current semester";
    if (!values.bio.trim()) missing.bio = "Write a short bio";
    if (values.bio.length > BIO_MAX) missing.bio = `Bio can be at most ${BIO_MAX} characters`;
    if (values.skills.length === 0) missing.skills = "Add at least one skill";
    if (isAlumnus && !values.field) missing.field = "Choose your field";
    if (isAlumnus && !values.company.trim()) missing.company = "Enter your company or organisation";
    setErrors(missing);
    return Object.keys(missing).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!checkRequired()) return;

    setSaving(true);
    const result = await requestJson("PUT", "/api/v1/profile", {
      ...values,
      batch: Number(values.batch),
      semester: isAlumnus || !values.semester ? null : Number(values.semester),
      field: isAlumnus ? values.field : null,
      company: isAlumnus ? values.company.trim() : null,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Profile saved");
      router.push(redirectTo);
      // The signed-in layout (which shows the member's name) is shared between pages and is not
      // re-rendered by a navigation, so it only needs a refresh when the name it shows has changed.
      // The destination page itself is rendered fresh by the navigation above.
      if (values.name.trim() !== initial.name.trim()) router.refresh();
      return;
    }
    const details = result.error.details as { path: string; message: string }[] | undefined;
    if (Array.isArray(details)) {
      setErrors(Object.fromEntries(details.map((d) => [d.path.split(".")[0], d.message])));
    } else {
      setFormError(result.error.message);
    }
  }

  const error = (field: Field) =>
    errors[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: Field) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  const years = Array.from({ length: maxBatch() - BATCH_FLOOR + 1 }, (_, i) => maxBatch() - i);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" value={values.name} onChange={(e) => update("name", e.target.value)} {...a11y("name")} />
        {error("name")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="batch">Batch (year of intake)</Label>
          <NativeSelect id="batch" value={values.batch} onChange={(e) => update("batch", e.target.value)} {...a11y("batch")}>
            <option value="">Choose…</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
          {error("batch")}
        </div>
        {isAlumnus ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="semester">Current semester</Label>
            <NativeSelect id="semester" value={values.semester} onChange={(e) => update("semester", e.target.value)} {...a11y("semester")}>
              <option value="">Choose…</option>
              {Array.from({ length: MAX_SEMESTER }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            {error("semester")}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="programme">Programme</Label>
          <NativeSelect id="programme" value={values.programme} onChange={(e) => update("programme", e.target.value)} {...a11y("programme")}>
            <option value="">Choose…</option>
            {PROGRAMMES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
          {error("programme")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <NativeSelect id="department" value={values.department} onChange={(e) => update("department", e.target.value)} {...a11y("department")}>
            <option value="">Choose…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
          {error("department")}
        </div>
      </div>

      {isAlumnus ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="field">Field</Label>
            <NativeSelect id="field" value={values.field} onChange={(e) => update("field", e.target.value)} {...a11y("field")}>
              <option value="">Choose…</option>
              {ALUMNI_FIELDS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </NativeSelect>
            {error("field")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company or organisation</Label>
            <Input id="company" autoComplete="organization" value={values.company} onChange={(e) => update("company", e.target.value)} {...a11y("company")} />
            {error("company")}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="bio">Short bio</Label>
          <span className={`text-xs ${values.bio.length > BIO_MAX ? "text-destructive" : "text-muted-foreground"}`}>
            {values.bio.length}/{BIO_MAX}
          </span>
        </div>
        <Textarea
          id="bio"
          rows={4}
          value={values.bio}
          onChange={(e) => update("bio", e.target.value)}
          placeholder="What you study, what you can help with, what you are looking for"
          {...a11y("bio")}
        />
        {error("bio")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skills">Skills</Label>
        <SkillsInput value={values.skills} onChange={(s) => update("skills", s)} invalid={Boolean(errors.skills)} describedBy={errors.skills ? "skills-error" : undefined} />
        {error("skills")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="courses">
          Courses taken <span className="font-normal text-muted-foreground">(optional, helps juniors find you)</span>
        </Label>
        <CoursePicker courses={courses} value={values.courseIds} onChange={(c) => update("courseIds", c)} invalid={Boolean(errors.courseIds)} describedBy={errors.courseIds ? "courseIds-error" : undefined} />
        {error("courseIds")}
      </div>

      <p className="text-xs text-muted-foreground">
        Your profile is self-declared and is not shown as verified. Your email stays hidden until you accept a connection.
      </p>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
