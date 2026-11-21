import { created, ok, route } from "@/lib/api/handler";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { requireMember } from "@/lib/auth/session";
import { boardQuerySchema, createPost, listOpenPosts, postSchema } from "@/lib/services/posts";

/** GET /api/v1/posts?type=&course=&department=&q=&page=: open posts on the Need Board (FR4.2, US4.2). */
export const GET = route(async (request) => {
  const member = await requireMember();
  const query = parseQuery(request, boardQuerySchema);
  const result = await listOpenPosts(member.id, query);
  // Storage paths stay on the server
  return ok({ ...result, posts: result.posts.map((p) => ({ ...p, author: { id: p.author.id, name: p.author.name } })) });
});

/** POST /api/v1/posts: publish a need post (FR4.1, US4.1). */
export const POST = route(async (request) => {
  const member = await requireMember();
  const input = await parseJson(request, postSchema);
  const post = await createPost(member.id, input);
  return created({ id: post.id, status: post.status, expiresAt: post.expiresAt });
});
