import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/members/profile-view";
import { ApiError } from "@/lib/api/errors";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { getMemberProfile } from "@/lib/services/member-profile";

export const metadata: Metadata = { title: "Member · IBA Connect" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Member profile (US2.6, wireframe P07). */
export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const viewer = await requireCompletedProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const profile = await getMemberProfile(viewer.id, id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/directory" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to the directory
      </Link>
      <ProfileView profile={profile} />
    </div>
  );
}
