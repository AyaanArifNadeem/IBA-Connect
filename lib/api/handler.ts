import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ApiError, conflict, validationFailed } from "./errors";

type Handler<Ctx> = (request: Request, ctx: Ctx) => Promise<Response>;

/** Turn any thrown error into the standard JSON error response. */
export function errorResponse(err: unknown): Response {
  const apiError = toApiError(err);
  if (apiError.status >= 500) {
    // Log the cause without request bodies, passwords or message content (NFR18)
    console.error("[api] unexpected error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (apiError.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(Math.ceil(apiError.retryAfterSeconds)));
  }
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code: apiError.code, message: apiError.message },
  };
  if (apiError.details !== undefined) body.error.details = apiError.details;
  return Response.json(body, { status: apiError.status, headers });
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return validationFailed(
      err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  if (isPrismaError(err, "P2002")) return conflict("That already exists.");
  if (isPrismaError(err, "P2025")) return new ApiError(404, "not_found", "Not found.");
  return new ApiError(500, "internal_error", "Something went wrong. Please try again.");
}

function isPrismaError(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === code;
}

/**
 * Wrap a route handler so every error becomes the standard JSON shape.
 *
 *   export const POST = route(async (request) => { ... return ok(data) })
 */
export function route<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      // Let Next.js handle its own control-flow errors (redirect, notFound, prerender bailout)
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

/** Successful JSON response; API responses are never cached. */
export function ok<T>(data: T, init: { status?: number } = {}): Response {
  return Response.json({ data }, { status: init.status ?? 200, headers: { "Cache-Control": "no-store" } });
}

export const created = <T>(data: T) => ok(data, { status: 201 });
export const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
