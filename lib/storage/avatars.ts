import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { ImageKind } from "./image-check";

/** Private Supabase Storage bucket for profile photos. Created once (docs/setup/supabase.md). */
export const AVATAR_BUCKET = "avatars";
/** Signed avatar links last one hour; they are made fresh on each page load. */
const SIGNED_URL_SECONDS = 60 * 60;

export async function uploadAvatar(memberId: string, bytes: Uint8Array, kind: ImageKind): Promise<string> {
  const path = `${memberId}/${randomUUID()}.${kind.ext}`;
  const { error } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (error) throw new Error(`Avatar upload failed: ${error.message}`);
  return path;
}

export async function deleteAvatar(path: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.warn("[storage] could not delete old avatar", { message: error.message });
}

/** Signed, time-limited link to an avatar, or null when there is none or storage is not configured. */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return error ? null : data.signedUrl;
}
