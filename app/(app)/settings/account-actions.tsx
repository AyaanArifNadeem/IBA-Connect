"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson, requestJson } from "@/lib/client/api";

type Mode = "deactivate" | "delete" | null;

/** Deactivate or delete the account (FR1.8). Both ask for confirmation; delete needs "DELETE" typed. */
export function AccountActions({ onDone = (url: string) => window.location.assign(url) }: { onDone?: (url: string) => void }) {
  const [mode, setMode] = useState<Mode>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setMode(null);
    setTyped("");
    setError(null);
  };

  async function confirm() {
    setBusy(true);
    setError(null);
    const result =
      mode === "deactivate"
        ? await postJson("/api/v1/account/deactivate", {})
        : await requestJson("DELETE", "/api/v1/account", { confirm: typed });
    setBusy(false);
    if (!result.ok) {
      const details = result.error.details as { message: string }[] | undefined;
      return setError(details?.[0]?.message ?? result.error.message);
    }
    onDone("/sign-out");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Deactivate account</p>
          <p className="text-muted-foreground">Hide your profile from the directory. Sign in again any time to come back.</p>
        </div>
        <Button variant="outline" onClick={() => setMode("deactivate")}>
          Deactivate
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Delete account</p>
          <p className="text-muted-foreground">Remove your profile and personal details for good. This cannot be undone.</p>
        </div>
        <Button variant="destructive" onClick={() => setMode("delete")}>
          Delete account
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "delete" ? "Delete your account?" : "Deactivate your account?"}</DialogTitle>
            <DialogDescription>
              {mode === "delete"
                ? "Your profile, photo, skills and courses are removed and you can no longer sign in. Your messages stay with the people you talked to but show “Deleted member”. Open posts are closed and pending requests declined."
                : "Your profile leaves the directory and you are signed out. Sign in again to reactivate it."}
            </DialogDescription>
          </DialogHeader>
          {mode === "delete" ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input id="confirm-delete" value={typed} onChange={(e) => (setTyped(e.target.value), setError(null))} autoComplete="off" />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button variant={mode === "delete" ? "destructive" : "default"} onClick={confirm} disabled={busy || (mode === "delete" && typed !== "DELETE")}>
              {busy ? "Working…" : mode === "delete" ? "Delete account" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
