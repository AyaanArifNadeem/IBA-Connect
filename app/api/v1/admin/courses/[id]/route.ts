import { z } from "zod";
import { ok, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireAdmin } from "@/lib/auth/session";
import { courseUpdateSchema, updateCourse } from "@/lib/services/admin-courses";

/** PATCH /api/v1/admin/courses/{id}: edit, retire or restore a course (FR1.10). */
export const PATCH = route<RouteContext<"/api/v1/admin/courses/[id]">>(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const input = await parseJson(request, courseUpdateSchema);
  return ok(await updateCourse(admin.id, z.uuid().parse(id), input));
});
