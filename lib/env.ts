import { z } from "zod";

const publicSchema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1),
  appUrl: z.url(),
});

/** Public settings, validated on first use so a missing variable fails with a clear message. */
export function publicEnv() {
  const parsed = publicSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid public environment variables: ${missing}. See .env.example.`);
  }
  return parsed.data;
}

/** Email domain accepted for Microsoft sign-in and IBA registration (FR1.1, NFR8). */
export function ibaEmailDomain(): string {
  return (process.env.IBA_EMAIL_DOMAIN ?? "khi.iba.edu.pk").toLowerCase();
}
