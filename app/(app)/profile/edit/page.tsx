import type { Metadata } from "next";
import { AdvisingCard } from "@/components/profile/advising-card";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { ProfileForm } from "@/components/profile/profile-form";
import { avatarUrl } from "@/lib/storage/avatars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompletedProfile } from "@/lib/auth/pages";
import { Role } from "@/lib/generated/prisma/enums";
import { getOwnProfile, listCourses } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Edit profile · IBA Connect" };

/** Edit profile (US1.6, wireframe P03). Changes show on the profile and in search. */
export default async function EditProfilePage() {
  const member = await requireCompletedProfile();
  const [profile, courses] = await Promise.all([getOwnProfile(member.id), listCourses()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
          <h1>Edit profile</h1>
        </CardTitle>
          <CardDescription>Changes appear on your profile and in search straight away.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarPicker name={profile.name} initialUrl={await avatarUrl(member.avatarPath)} />
          <ProfileForm
            isAlumnus={member.role === Role.ALUMNUS}
            courses={courses}
            submitLabel="Save changes"
            redirectTo="/profile"
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
      <AdvisingCard initialAvailable={profile.availableToAdvise} courses={profile.courses} />
    </div>
  );
}
