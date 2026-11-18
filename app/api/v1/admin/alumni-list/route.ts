import { badRequest } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { alumniListSummary, importAlumniList } from "@/lib/services/admin-alumni";

const MAX_BYTES = 1024 * 1024;

/** GET /api/v1/admin/alumni-list: how many alumni are on the list and how many have joined. */
export const GET = route(async () => {
  await requireAdmin();
  return ok(await alumniListSummary());
});

/** POST /api/v1/admin/alumni-list (multipart, field "file", CSV): import the alumni list (FR1.9). */
export const POST = route(async (request) => {
  const admin = await requireAdmin();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Upload the alumni list as a CSV file.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw badRequest("Choose a CSV file to upload.");
  if (file.size > MAX_BYTES) throw badRequest("The file must be 1 MB or smaller.");
  if (!/\.csv$/i.test(file.name)) throw badRequest("Only .csv files are accepted.");

  const result = await importAlumniList(admin.id, await file.text());
  return ok({ ...result, summary: await alumniListSummary() });
});
