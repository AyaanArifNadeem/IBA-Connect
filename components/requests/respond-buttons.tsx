"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client/api";

/** Accept / Decline on an incoming request (FR3.2, US3.3). */
export function RespondButtons({ connectionId, name }: { connectionId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    const result = await requestJson("PATCH", `/api/v1/connections/${connectionId}`, { action });
    setBusy(null);
    if (!result.ok) return toast.error(result.error.message);
    toast.success(action === "accept" ? `You are now connected with ${name}` : "Request declined");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => respond("decline")} aria-label={`Decline request from ${name}`}>
        {busy === "decline" ? "Declining…" : "Decline"}
      </Button>
      <Button size="sm" disabled={busy !== null} onClick={() => respond("accept")} aria-label={`Accept request from ${name}`}>
        {busy === "accept" ? "Accepting…" : "Accept"}
      </Button>
    </div>
  );
}
