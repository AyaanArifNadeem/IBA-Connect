import { ok, route } from "@/lib/api/handler";
import { requireMember } from "@/lib/auth/session";
import { listMyPosts } from "@/lib/services/posts";

/** GET /api/v1/posts/mine: your posts with their state (open, closed, expired) (FR4.4). */
export const GET = route(async () => {
  const member = await requireMember();
  return ok(await listMyPosts(member.id));
});
