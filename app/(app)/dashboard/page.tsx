import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { getDashboard } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard · IBA Connect" };

/** Dashboard after sign-in (FR1.7, wireframe P04). */
export default async function DashboardPage() {
  const member = await requireCompletedProfile();
  const data = await getDashboard(member.id);
  return <DashboardView name={member.name} data={data} />;
}
