import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** "Available to advise" badge on profiles and search results (FR1.5). */
export function AdviseBadge({ courses }: { courses?: string[] }) {
  const title = courses?.length ? `Can advise on ${courses.join(", ")}` : undefined;
  return (
    <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600" title={title}>
      <GraduationCap aria-hidden className="size-3" />
      Available to advise
    </Badge>
  );
}
