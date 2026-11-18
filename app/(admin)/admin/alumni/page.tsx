import type { Metadata } from "next";
import { AlumniCodesPanel } from "@/components/admin/alumni-codes-panel";
import { AlumniListPanel } from "@/components/admin/alumni-list-panel";
import { getCurrentMember } from "@/lib/auth/session";
import { Role } from "@/lib/generated/prisma/enums";
import { alumniListSummary, listCodes } from "@/lib/services/admin-alumni";

export const metadata: Metadata = { title: "Alumni codes · Admin · IBA Connect" };

/** Alumni codes and the alumni list (FR1.9, wireframe P20). */
export default async function AdminAlumniPage() {
  const member = await getCurrentMember();
  if (member?.role !== Role.ADMIN) return null; // AdminGate already shows "No access"

  const [codes, summary] = await Promise.all([listCodes(), alumniListSummary()]);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <AlumniCodesPanel
        codes={codes.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          claimedAt: c.claimedAt?.toISOString() ?? null,
        }))}
      />
      <AlumniListPanel summary={summary} />
    </div>
  );
}
