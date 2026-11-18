import { badRequest } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { avatarUrl, deleteAvatar, uploadAvatar } from "@/lib/storage/avatars";
import { AVATAR_MAX_BYTES, detectImage } from "@/lib/storage/image-check";

/** POST /api/v1/profile/avatar (multipart, field "file"): upload a profile photo (US1.6). */
export const POST = route(async (request) => {
  const member = await requireMember();
  await enforceRateLimit({ key: `avatar:${member.id}`, limit: 20, windowMs: 60 * 60_000, userId: member.id });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Upload the photo as a file.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw badRequest("Choose an image to upload.");
  if (file.size > AVATAR_MAX_BYTES) throw badRequest("The photo must be 2 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) throw badRequest("Only image files (PNG, JPEG or WebP) can be used as a profile photo.");

  const path = await uploadAvatar(member.id, bytes, kind);
  await db.user.update({ where: { id: member.id }, data: { avatarPath: path } });
  if (member.avatarPath) await deleteAvatar(member.avatarPath);

  return ok({ avatarUrl: await avatarUrl(path) });
});

/** DELETE /api/v1/profile/avatar: remove the profile photo. */
export const DELETE = route(async () => {
  const member = await requireMember();
  if (member.avatarPath) {
    await db.user.update({ where: { id: member.id }, data: { avatarPath: null } });
    await deleteAvatar(member.avatarPath);
  }
  return ok({ avatarUrl: null });
});
