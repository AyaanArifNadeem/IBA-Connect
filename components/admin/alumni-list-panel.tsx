"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Summary = { total: number; claimed: number };
type Result = { added: number; skipped: number; invalid: { line: number; reason: string }[] };

/** Upload the university's alumni list as CSV (FR1.9). */
export function AlumniListPanel({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a CSV file first.");
    setUploading(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/v1/admin/alumni-list", { method: "POST", body });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult(payload.data);
        router.refresh();
      } else setError(payload.error?.message ?? "Upload failed. Please try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alumni list</CardTitle>
        <CardDescription>
          {summary.total} alumni on the list, {summary.claimed} joined. Alumni whose personal email is on the list can
          verify themselves.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={upload} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="alumni-csv">CSV file</Label>
            <input
              id="alumni-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              First row: <code>email,name,batch</code>. Only <code>email</code> is required. Up to 5,000 rows.
            </p>
          </div>
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload list"}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {result ? (
          <div role="status" className="mt-3 space-y-1 text-sm">
            <p>
              Added <strong>{result.added}</strong>, skipped {result.skipped} already on the list.
            </p>
            {result.invalid.length ? (
              <details>
                <summary className="cursor-pointer text-destructive">{result.invalid.length} rows could not be read</summary>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {result.invalid.map((r) => (
                    <li key={r.line}>
                      Line {r.line}: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
