import { timingSafeEqual } from "node:crypto";
import { notFound, unauthorized } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/handler";
import { drainEmailOutbox } from "@/lib/services/email-outbox";

function validSecret(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * GET /api/v1/internal/email-outbox: send the notification emails that are due, retrying earlier
 * failures (FR3.6). Called by the scheduled job in vercel.json, which sends `Authorization: Bearer
 * $CRON_SECRET`. Not a member endpoint: without CRON_SECRET configured it does not exist.
 */
export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw notFound("Not found.");
  if (!validSecret(request.headers.get("authorization"), secret)) throw unauthorized();
  return ok(await drainEmailOutbox({ limit: 50 }));
});
