import { z } from "zod";

/** IBA email domain, also used by client-side checks. The server reads IBA_EMAIL_DOMAIN. */
export const DEFAULT_IBA_DOMAIN = "khi.iba.edu.pk";

const SPECIAL = /[!@#$%^&*()_\-=[\]{};':"\\|,.<>/?`~+]/;

/**
 * Password rules (FR1.2), the same ones the register page shows: 8 to 72 characters
 * (bcrypt uses at most 72 bytes), no spaces, and upper case, lower case, a digit and a symbol.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password must be at most 72 characters long")
  .refine((p) => !/\s/.test(p), "Password cannot contain spaces")
  .refine(
    (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && SPECIAL.test(p),
    "Password must include an uppercase, lowercase, number, and special character",
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

/** True when the email is exactly on the IBA domain (no look-alike sub- or super-domains). */
export function hasIbaDomain(email: string, domain = DEFAULT_IBA_DOMAIN): boolean {
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1).toLowerCase() === domain.toLowerCase();
}

export function registerSchema(domain = DEFAULT_IBA_DOMAIN) {
  return z.object({
    name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
    email: emailSchema.refine((e) => hasIbaDomain(e, domain), `Only @${domain} accounts can join`),
    password: passwordSchema,
  });
}

export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>;

export const signInSchema = z.object({
  email: emailSchema,
  // Do not apply the password rules here: older passwords must still be accepted.
  password: z.string().min(1, "Enter your password").max(200),
});

export const emailOnlySchema = z.object({ email: emailSchema });

/** Only allow redirects to paths inside this app (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
