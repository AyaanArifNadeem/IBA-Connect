import { created, ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireAdmin } from "@/lib/auth/session";
import { addCourse, courseSchema, listAllCourses } from "@/lib/services/admin-courses";

/** GET /api/v1/admin/courses: every course, retired ones too (FR1.10). */
export const GET = route(async () => {
  await requireAdmin();
  return ok(await listAllCourses());
});

/** POST /api/v1/admin/courses: add a course (FR1.10). */
export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const input = await parseJson(request, courseSchema);
  return created(await addCourse(admin.id, input));
});
