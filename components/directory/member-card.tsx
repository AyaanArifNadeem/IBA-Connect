import Link from "next/link";
import { AdviseBadge } from "@/components/profile/advise-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { initialsOf } from "@/lib/navigation";
import type { MemberCardData } from "@/lib/services/directory";

/** Directory card (wireframe P06). Shows no contact details (FR2.1, NFR10). */
export function MemberCard({ member }: { member: MemberCardData }) {
  const subtitle = member.isAlumnus
    ? ["Alumnus", member.field, member.company].filter(Boolean).join(" · ")
    : [member.programme, member.batch].filter(Boolean).join(" · ");

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{member.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {member.adviseCourses.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <AdviseBadge courses={member.adviseCourses} />
            <span className="text-xs text-muted-foreground">{member.adviseCourses.join(", ")}</span>
          </div>
        ) : null}
        {member.skills.length ? (
          <ul className="flex flex-wrap gap-1" aria-label="Skills">
            {member.skills.map((s) => (
              <li key={s}>
                <Badge variant="outline">{s}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/members/${member.id}`}
          className="mt-auto inline-flex h-8 items-center justify-center rounded-lg border text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          View profile<span className="sr-only">: {member.name}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
