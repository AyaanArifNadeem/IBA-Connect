"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components (auth flows only; data goes through /api/v1). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
