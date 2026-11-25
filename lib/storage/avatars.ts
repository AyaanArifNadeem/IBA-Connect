import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { ImageKind } from "./image-check";

/** Private Supabase Storage bucket for profile photos. Created once (docs/setup/supabase.md). */
export const AVATAR_BUCKET = "avatars";
/** Signed avatar links last one hour. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Signing is a request to Supabase Storage, and the same few paths (the member's own avatar in the
 * shell, the people in the directory and in chat) are signed again on page after page. Links are
 * therefore reused for 45 minutes, so a link handed out from the cache always has at least 15 of its
 * 60 minutes left. The bucket stays private and links stay time-limited.
 *
 * The cache lives in the memory of one server instance (instances do not share it) and holds at most
 * CACHE_MAX links; the least recently used one is dropped first. Avatars are uploaded under a new
 * path each time, so replacing a photo never reuses a cached link for the old one.
 */
export const URL_CACHE_TTL_MS = 45 * 60_000;
export const URL_CACHE_MAX = 500;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function cachedUrl(path: string, now: number): string | null {
  const hit = urlCache.get(path);
  if (!hit) return null;
  urlCache.delete(path);
  if (hit.expiresAt <= now) return null;
  urlCache.set(path, hit); // most recently used goes last
  return hit.url;
}

function rememberUrl(path: string, url: string, now: number) {
  urlCache.delete(path);
  urlCache.set(path, { url, expiresAt: now + URL_CACHE_TTL_MS });
  while (urlCache.size > URL_CACHE_MAX) {
    const oldest = urlCache.keys().next().value;
    if (oldest === undefined) break;
    urlCache.delete(oldest);
  }
}

/** For tests. */
export function clearAvatarUrlCache() {
  urlCache.clear();
}

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
  urlCache.delete(path); // never hand out a link to a photo that has been removed
  if (error) console.warn("[storage] could not delete old avatar", { message: error.message });
}

/** Signed, time-limited link to an avatar, or null when there is none or storage is not configured. */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const now = Date.now();
  const hit = cachedUrl(path, now);
  if (hit) return hit;
  const { data, error } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) return null;
  rememberUrl(path, data.signedUrl, now);
  return data.signedUrl;
}

/** Signed links for many avatars in one call (directory pages). Keys are storage paths. */
export async function avatarUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();

  const now = Date.now();
  const urls = new Map<string, string>();
  const missing: string[] = [];
  for (const path of wanted) {
    const hit = cachedUrl(path, now);
    if (hit) urls.set(path, hit);
    else missing.push(path);
  }
  if (missing.length === 0) return urls;

  // Still one batched call for everything that is not cached yet
  const { data, error } = await createAdminClient().storage.from(AVATAR_BUCKET).createSignedUrls(missing, SIGNED_URL_SECONDS);
  if (error || !data) return urls;
  for (const d of data) {
    if (!d.path || !d.signedUrl) continue;
    urls.set(d.path, d.signedUrl);
    rememberUrl(d.path, d.signedUrl, now);
  }
  return urls;
}
