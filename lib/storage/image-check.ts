/** Avatar rules (US1.6): images only, checked by their content, at most 2 MB. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type ImageKind = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

/**
 * Identify PNG, JPEG or WebP from the first bytes of the file. The browser's file name and
 * content type are not trusted (a renamed PDF must still be rejected).
 */
export function detectImage(bytes: Uint8Array): ImageKind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}
