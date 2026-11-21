"use client";

import { useState } from "react";
import { postJson } from "@/lib/client/api";

export function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({
    kind: "idle",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    const result = await postJson<{ message: string }>("/api/v1/auth/resend-verification", { email });
    setStatus(result.ok ? { kind: "sent", message: result.data.message } : { kind: "error", message: result.error.message });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 text-left">
      <label htmlFor="resend-email" className="ml-1 text-xs font-semibold text-gray-700">
        Email address
      </label>
      <input
        id="resend-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@khi.iba.edu.pk"
        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm focus:ring-2 focus:ring-[#8b0000]/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="w-full rounded-xl bg-[#8b0000] py-2 text-sm font-semibold text-white hover:bg-[#6b0000] disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending..." : "Send a new link"}
      </button>
      {status.message ? (
        <p role="status" className={`text-xs ${status.kind === "error" ? "text-red-700" : "text-gray-600"}`}>
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
