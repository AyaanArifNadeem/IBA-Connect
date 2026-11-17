import type { Metadata } from "next";
import { getCurrentMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard · IBA Connect" };

// The full dashboard (pending requests, unread messages, my posts) is backlog item FR1.7.
export default async function DashboardPage() {
  const member = await getCurrentMember();
  const firstName = member?.name.split(" ")[0] ?? "there";
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Hi {firstName}</h1>
      <p className="text-muted-foreground">Welcome to IBA Connect.</p>
    </div>
  );
}
