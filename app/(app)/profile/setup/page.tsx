import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/session";
import { Role } from "@/lib/generated/prisma/enums";
import { getOwnProfile, listCourses } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Set up your profile · IBA Connect" };

/** First-time profile setup (US1.5, wireframe P03). */
export default async function ProfileSetupPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/sign-in");
  if (member.profileCompletedAt) redirect("/dashboard");

  const [profile, courses] = await Promise.all([getOwnProfile(member.id), listCourses()]);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Set up your profile</h1>
        </CardTitle>
        <CardDescription>
          A few details so other members can find you by course and skill. You can change them any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm
          isAlumnus={member.role === Role.ALUMNUS}
          courses={courses}
          submitLabel="Finish setup"
          redirectTo="/dashboard"
          initial={{
            name: profile.name,
            batch: profile.batch ? String(profile.batch) : "",
            programme: profile.programme ?? "",
            department: profile.department ?? "",
            semester: profile.semester ? String(profile.semester) : "",
            bio: profile.bio,
            skills: profile.skills,
            courseIds: profile.courses.map((c) => c.id),
            field: profile.field ?? "",
            company: profile.company ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
