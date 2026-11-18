import { created, route } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { createPost, postSchema } from "@/lib/services/posts";

/** POST /api/v1/posts: publish a need post (FR4.1, US4.1). */
export const POST = route(async (request) => {
  const member = await requireMember();
  const input = await parseJson(request, postSchema);
  const post = await createPost(member.id, input);
  return created({ id: post.id, status: post.status, expiresAt: post.expiresAt });
});
