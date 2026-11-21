import "server-only";
import { validationFailed } from "@/lib/api/errors";
import { db } from "@/lib/db";

/**
 * Available to advise (FR1.5, US1.8). When on, the member picks which of their own courses
 * they can help with; when off, every course loses the advise flag and the badge disappears.
 */
export async function setAdvising(memberId: string, available: boolean, courseIds: string[]) {
  const wanted = [...new Set(courseIds)];

  if (available) {
    if (wanted.length === 0) {
      throw validationFailed([{ path: "courseIds", message: "Choose at least one course you can advise on" }]);
    }
    const own = await db.userCourse.count({ where: { userId: memberId, courseId: { in: wanted } } });
    if (own !== wanted.length) {
      throw validationFailed([{ path: "courseIds", message: "You can only advise on courses in your profile" }]);
    }
  }

  await db.$transaction([
    db.userCourse.updateMany({ where: { userId: memberId }, data: { canAdvise: false } }),
    ...(available
      ? [db.userCourse.updateMany({ where: { userId: memberId, courseId: { in: wanted } }, data: { canAdvise: true } })]
      : []),
    db.user.update({ where: { id: memberId }, data: { availableToAdvise: available } }),
  ]);
}
