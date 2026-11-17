import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { VerificationMethod } from "@/lib/generated/prisma/enums";
import { ensureMember, landingPathFor } from "@/lib/services/members";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/auth";

const EMAIL_LINK_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/**
 * GET /auth/confirm?token_hash=...&type=...&next=...
 * Target of the links in Supabase Auth emails (verification and password reset).
 * Verifies the token, which signs the member in, then redirects.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));

  const fail = (reason: string) => NextResponse.redirect(new URL(`/verify?error=${reason}`, url.origin));

  if (!tokenHash || !type || !EMAIL_LINK_TYPES.includes(type)) return fail("invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return fail(error?.code === "otp_expired" ? "expired" : "invalid");

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", url.origin));
  }

  const member = await ensureMember({
    id: data.user.id,
    email: data.user.email ?? "",
    name: String(data.user.user_metadata?.name ?? ""),
    method: VerificationMethod.EMAIL,
  });

  const destination = member.profileCompletedAt ? next : landingPathFor(member);
  return NextResponse.redirect(new URL(destination, url.origin));
}
