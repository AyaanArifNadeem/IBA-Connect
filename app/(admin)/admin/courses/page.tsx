import type { Metadata } from "next";
import { CoursesPanel } from "@/components/admin/courses-panel";
import { getCurrentMember } from "@/lib/auth/session";
import { Role } from "@/lib/generated/prisma/enums";
import { listAllCourses } from "@/lib/services/admin-courses";

export const metadata: Metadata = { title: "Courses · Admin · IBA Connect" };

/** Course list management (FR1.10, wireframe P20). */
export default async function AdminCoursesPage() {
  const member = await getCurrentMember();
  if (member?.role !== Role.ADMIN) return null; // AdminGate already shows "No access"
  return <CoursesPanel courses={await listAllCourses()} />;
}
