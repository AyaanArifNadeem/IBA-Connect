"use client";

import { Copy } from "lucide-react";
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

export type CodeRow = {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  claimedBy: string | null;
  status: "active" | "claimed" | "expired" | "revoked";
};

const STATUS_STYLE: Record<CodeRow["status"], string> = {
  active: "bg-emerald-600 text-white",
  claimed: "bg-sky-600 text-white",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/15 text-destructive",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never";

/** Create, list, expire and revoke alumni codes (FR1.9). */
export function AlumniCodesPanel({ codes }: { codes: CodeRow[] }) {
  const router = useRouter();
  const [expiry, setExpiry] = useState("30");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    const result = await postJson<{ code: string }>("/api/v1/admin/alumni-codes", {
      expiresInDays: expiry === "never" ? null : Number(expiry),
      note: note || undefined,
    });
    setBusy(null);
    if (!result.ok) return toast.error(result.error.message);
    setLastCode(result.data.code);
    setNote("");
    router.refresh();
  }

  async function end(id: string, action: "expire" | "revoke") {
    setBusy(id);
    const result = await requestJson("PATCH", `/api/v1/admin/alumni-codes/${id}`, { action });
    setBusy(null);
    if (!result.ok) return toast.error(result.error.message);
    toast.success(action === "revoke" ? "Code revoked" : "Code expired");
    router.refresh();
  }

  async function copy(code: string) {
    await navigator.clipboard?.writeText(code);
    toast.success("Code copied");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alumni codes</CardTitle>
        <CardDescription>Give a code to an alumnus who is not on the alumni list. Each code works once.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="expiry">Expires</Label>
            <NativeSelect id="expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              <option value="7">In 7 days</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="never">Never</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">For (optional)</Label>
            <Input id="note" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Class of 2015 reunion" />
          </div>
          <Button type="submit" disabled={busy === "create"}>
            {busy === "create" ? "Creating…" : "New code"}
          </Button>
        </form>

        {lastCode ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
            <span>
              New code: <span className="font-mono font-semibold">{lastCode}</span>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(lastCode)}>
              <Copy aria-hidden /> Copy
            </Button>
          </div>
        ) : null}

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Expires</th>
                  <th className="py-2 pr-3 font-medium">Used by / for</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{c.code}</td>
                    <td className="py-2 pr-3">
                      <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(c.expiresAt)}</td>
                    <td className="py-2 pr-3">{c.claimedBy ?? c.note ?? "—"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {c.status === "active" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Copy ${c.code}`} onClick={() => copy(c.code)}>
                            <Copy aria-hidden />
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => end(c.id, "expire")}>
                            Expire
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy === c.id} onClick={() => end(c.id, "revoke")}>
                            Revoke
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
