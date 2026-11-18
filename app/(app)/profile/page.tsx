import { redirect } from "next/navigation";
import { requireCompletedProfile } from "@/lib/auth/pages";

// "My profile" opens the member's own profile page, as others see it.
export default async function MyProfilePage() {
  const member = await requireCompletedProfile();
  redirect(`/members/${member.id}`);
}
