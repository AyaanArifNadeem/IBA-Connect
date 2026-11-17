/**
 * Errors the API returns on purpose. Every error response has the same JSON shape
 * (SRS 5.4): { "error": { "code": string, "message": string, "details"?: unknown } }.
 */
export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "email_not_verified"
  | "forbidden"
  | "suspended"
  | "profile_incomplete"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
    /** Seconds the client should wait before retrying (429 only). */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);
export const validationFailed = (details: unknown) =>
  new ApiError(400, "validation_failed", "Some fields are missing or invalid.", details);
export const unauthorized = (message = "Please sign in to continue.") =>
  new ApiError(401, "unauthorized", message);
export const emailNotVerified = () =>
  new ApiError(403, "email_not_verified", "Please verify your email address first.");
export const forbidden = (message = "You do not have permission to do that.") =>
  new ApiError(403, "forbidden", message);
export const suspended = () =>
  new ApiError(403, "suspended", "Your account is suspended. Contact the IBA Connect team.");
export const profileIncomplete = () =>
  new ApiError(403, "profile_incomplete", "Please complete your profile first.");
export const notFound = (message = "Not found.") => new ApiError(404, "not_found", message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "conflict", message, details);
export const rateLimited = (message: string, retryAfterSeconds: number) =>
  new ApiError(429, "rate_limited", message, undefined, retryAfterSeconds);
