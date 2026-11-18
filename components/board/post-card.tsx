import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { POST_TYPE_LABELS, daysLeft, type PostTypeValue } from "@/lib/board";
import { initialsOf } from "@/lib/navigation";

export type PostCardData = {
  id: string;
  type: PostTypeValue;
  title: string;
  body: string;
  courseCode: string | null;
  departmentTag: string | null;
  expiresAt: string;
  author: { id: string; name: string };
  mine: boolean;
  responses: number;
};

/** A need post on the board (wireframe P10). The action (Respond or Manage) is passed in. */
export function PostCard({ post, avatarUrl, action }: { post: PostCardData; avatarUrl?: string | null; action?: ReactNode }) {
  const left = daysLeft(post.expiresAt);
  const tag = post.courseCode ?? post.departmentTag;
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>{POST_TYPE_LABELS[post.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            {post.mine ? "Your post · " : ""}
            {left} {left === 1 ? "day" : "days"} left
          </span>
        </div>
        <h2 className="font-semibold leading-snug break-words">{post.title}</h2>
        <p className="line-clamp-3 text-sm break-words text-muted-foreground">{post.body}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Avatar className="size-6">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initialsOf(post.author.name)}</AvatarFallback>
          </Avatar>
          <span>{post.mine ? "You" : post.author.name}</span>
          {tag ? <Badge variant="outline">{tag}</Badge> : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {post.responses} {post.responses === 1 ? "response" : "responses"}
          </span>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
