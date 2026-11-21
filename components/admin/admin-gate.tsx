import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentMember } from "@/lib/auth/session";
import { Role } from "@/lib/generated/prisma/enums";
import { AdminTabs } from "./admin-tabs";

/** Shows admin pages to admins only (FR8.5). The admin API routes check this again. */
export async function AdminGate({ children }: { children: ReactNode }) {
  const member = await getCurrentMember();
  if (member?.role !== Role.ADMIN) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="text-2xl font-bold">No access</h1>
        <p className="text-muted-foreground">The admin panel is only for the IBA Connect team.</p>
        <Link href="/dashboard" className="text-sm font-medium text-primary underline">
          Back to your dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
