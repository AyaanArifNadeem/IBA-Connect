"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestJson } from "@/lib/client/api";
import { AdviseBadge } from "./advise-badge";

type Course = { id: string; code: string; title: string; canAdvise: boolean };

/** Available-to-advise switch with the courses the member can help with (US1.8). */
export function AdvisingCard({ initialAvailable, courses }: { initialAvailable: boolean; courses: Course[] }) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [selected, setSelected] = useState(() => new Set(courses.filter((c) => c.canAdvise).map((c) => c.id)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(initialAvailable);

  function toggle(id: string) {
    setError(null);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (available && selected.size === 0) {
      setError("Choose at least one course you can advise on");
      return;
    }
    setSaving(true);
    const result = await requestJson<{ availableToAdvise: boolean }>("PUT", "/api/v1/profile/advising", {
      available,
      courseIds: available ? [...selected] : [],
    });
    setSaving(false);
    if (!result.ok) {
      const details = result.error.details as { message: string }[] | undefined;
      setError(details?.[0]?.message ?? result.error.message);
      return;
    }
    setSavedAvailable(result.data.availableToAdvise);
    toast.success(available ? "You are now available to advise" : "Advising turned off");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Available to advise</CardTitle>
          {savedAvailable ? <AdviseBadge /> : null}
        </div>
        <CardDescription>
          Juniors searching for a course can find seniors who are happy to help with it. Your email stays hidden until you
          accept their connection request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            aria-checked={available}
            checked={available}
            onChange={(e) => {
              setAvailable(e.target.checked);
              setError(null);
            }}
            className="peer size-0 opacity-0"
          />
          <span
            aria-hidden
            className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-4"
          />
          I am available to advise
        </label>

        {available ? (
          courses.length ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm text-muted-foreground">Courses I can help with</legend>
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="font-medium">{c.code}</span>
                  <span className="text-muted-foreground">{c.title}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add the courses you have taken to your profile first, then choose the ones you can advise on.{" "}
              <Link href="#courses" className="underline">
                Add courses
              </Link>
            </p>
          )
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={save} disabled={saving || (available && courses.length === 0)}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
