import { type NextRequest, NextResponse } from "next/server";
import { ibaEmailDomain } from "@/lib/env";
import { UserStatus, VerificationMethod } from "@/lib/generated/prisma/enums";
import { isAllowedMicrosoftUser, microsoftDisplayName } from "@/lib/auth/microsoft";
import { db } from "@/lib/db";
import { ensureMember, landingPathFor } from "@/lib/services/members";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/auth";

/**
 * GET /auth/callback?code=...&next=... : return from Microsoft sign-in (FR1.1, US1.1).
 * Only verified IBA accounts get in. Anyone else is signed out and the auth account Supabase
 * just created is deleted, so no IBA Connect account exists for them.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const toSignIn = (reason: string) => NextResponse.redirect(new URL(`/sign-in?reason=${reason}`, url.origin));

  if (!code) return toSignIn("microsoft-failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return toSignIn("microsoft-failed");
  const user = data.user;

  if (!isAllowedMicrosoftUser(user, ibaEmailDomain())) {
    console.warn("[auth] Microsoft sign-in refused: not a verified IBA account");
    await supabase.auth.signOut();
    // Remove the auth account only if it has no member record (never delete a real member)
    const member = await db.user.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!member) await createAdminClient().auth.admin.deleteUser(user.id);
    return toSignIn("not-iba");
  }

  const member = await ensureMember({
    id: user.id,
    email: user.email!,
    name: microsoftDisplayName(user.user_metadata, user.email!),
    method: VerificationMethod.MICROSOFT,
  });

  if (member.status === UserStatus.SUSPENDED) {
    return NextResponse.redirect(new URL("/sign-out?reason=suspended", url.origin));
  }

  const destination = member.profileCompletedAt ? next : landingPathFor(member);
  return NextResponse.redirect(new URL(destination, url.origin));
}
