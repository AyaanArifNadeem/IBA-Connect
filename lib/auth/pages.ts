import "server-only";
import { redirect } from "next/navigation";
import { getCurrentMember } from "./session";

/**
 * For member pages that need a finished profile: sends new members to profile setup first
 * (US1.1, US1.5). The signed-in layout has already checked the session.
 */
export async function requireCompletedProfile() {
  const member = await getCurrentMember();
  if (!member) redirect("/sign-in");
  if (!member.profileCompletedAt) redirect("/profile/setup");
  return member;
}
