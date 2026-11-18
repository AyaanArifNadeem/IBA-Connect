"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/navigation";
import { AVATAR_MAX_BYTES } from "@/lib/storage/image-check";

type Props = { name: string; initialUrl: string | null };

/** Profile photo: upload or remove (US1.6). The server checks the file is really an image. */
export function AvatarPicker({ name, initialUrl }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "POST" | "DELETE", body?: FormData) {
    setBusy(true);
    setError(null);
    let message = "Something went wrong. Please try again.";
    try {
      const res = await fetch("/api/v1/profile/avatar", { method, body });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setUrl(payload.data?.avatarUrl ?? null);
        toast.success(method === "POST" ? "Photo updated" : "Photo removed");
        router.refresh();
        return;
      }
      message = payload.error?.message ?? message;
    } catch {
      message = "Could not reach the server. Check your connection and try again.";
    } finally {
      setBusy(false);
    }
    setError(message);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files (PNG, JPEG or WebP) can be used as a profile photo.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("The photo must be 2 MB or smaller.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    void send("POST", body);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {url ? <AvatarImage src={url} alt={`${name}'s profile photo`} /> : null}
        <AvatarFallback className="text-lg">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : url ? "Change photo" : "Upload photo"}
          </Button>
          {url ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void send("DELETE")}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Profile photo file"
          onChange={onFile}
        />
      </div>
    </div>
  );
}
