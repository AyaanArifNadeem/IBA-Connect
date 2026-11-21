import type { z } from "zod";
import { badRequest } from "./errors";

/** Parse and validate a JSON request body (NFR7: validate every input on the server). */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("The request body must be valid JSON.");
  }
  return schema.parse(body);
}

/** Parse and validate URL query parameters. Repeated keys become arrays. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  return schema.parse(paramsToObject(new URL(request.url).searchParams));
}

/** Query parameters as an object; repeated keys become arrays and empty values are dropped. */
export function paramsToObject(params: URLSearchParams): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key).filter((v) => v.trim() !== "");
    if (values.length) raw[key] = values.length > 1 ? values : values[0];
  }
  return raw;
}

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
