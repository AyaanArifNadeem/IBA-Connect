import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdviseBadge } from "@/components/profile/advise-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initialsOf } from "@/lib/navigation";
import type { MemberProfile } from "@/lib/services/member-profile";

/**
 * A member's profile (US2.6, wireframe P07). Actions (Connect, Message, Block) are passed in
 * by the page so this view stays the same for every viewer.
 */
export function ProfileView({ profile, actions }: { profile: MemberProfile; actions?: ReactNode }) {
  const details = [
    profile.programme,
    profile.department,
    profile.batch ? `Batch ${profile.batch}` : null,
    profile.semester ? `Semester ${profile.semester}` : null,
  ].filter(Boolean);
  const adviseCourses = profile.courses.filter((c) => c.canAdvise).map((c) => c.code);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar className="size-20 text-xl">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={`${profile.name}'s profile photo`} /> : null}
            <AvatarFallback>{initialsOf(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <Badge variant="outline">{profile.isAlumnus ? "Alumnus" : "Student"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
            {profile.isAlumnus && (profile.field || profile.company) ? (
              <p className="text-sm">{[profile.field, profile.company].filter(Boolean).join(" at ")}</p>
            ) : null}
            {adviseCourses.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <AdviseBadge courses={adviseCourses} />
                <span className="text-sm text-muted-foreground">for {adviseCourses.join(", ")}</span>
              </div>
            ) : null}
            <p className="flex items-center gap-1.5 text-sm">
              {profile.email ? (
                <>
                  <Mail aria-hidden className="size-4 text-muted-foreground" />
                  <a href={`mailto:${profile.email}`} className="underline">
                    {profile.email}
                  </a>
                </>
              ) : (
                <>
                  <Lock aria-hidden className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email hidden until you are connected</span>
                </>
              )}
            </p>
          </div>
          {actions ? <div className="flex flex-col gap-2 sm:w-44">{actions}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About and skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.bio ? <p className="whitespace-pre-line">{profile.bio}</p> : null}
          {profile.skills.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
              {profile.skills.map((s) => (
                <li key={s}>
                  <Badge variant="secondary">{s}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {profile.courses.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Courses taken</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {profile.courses.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{c.code}</span> <span className="text-muted-foreground">{c.title}</span>
                  </span>
                  {c.canAdvise ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Can advise</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Profile details are self-declared by the member and are not verified by IBA.
        {profile.isSelf ? (
          <>
            {" "}
            <Link href="/profile/edit" className="underline">
              Edit your profile
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
