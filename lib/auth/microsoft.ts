import { hasIbaDomain } from "@/lib/validation/auth";

/** The parts of a Supabase user that decide whether a Microsoft sign-in is allowed. */
export type OAuthUser = {
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
};

/**
 * FR1.1, NFR8: a Microsoft sign-in is accepted only when Microsoft says the email is verified
 * (Supabase sets email_confirmed_at from the token's verified-email claim, xms_edov) and the
 * email is exactly on the IBA domain. Checked on the server, after the code exchange.
 */
export function isAllowedMicrosoftUser(user: OAuthUser, domain: string): boolean {
  if (!user.email || !user.email_confirmed_at) return false;
  const providers = user.app_metadata?.providers ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
  if (!providers.includes("azure")) return false;
  return hasIbaDomain(user.email, domain);
}

/** Display name from the Microsoft profile. */
export function microsoftDisplayName(metadata: Record<string, unknown> | null | undefined, email: string): string {
  const name = metadata?.full_name ?? metadata?.name;
  return typeof name === "string" && name.trim() ? name.trim() : email.split("@")[0];
}
