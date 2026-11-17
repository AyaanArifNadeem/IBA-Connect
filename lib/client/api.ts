/** Browser helper for calling /api/v1 routes. Never throws; returns a typed result. */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; details?: unknown } };

const NETWORK_ERROR = { code: "network_error", message: "Could not reach the server. Check your connection and try again." };

export async function requestJson<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }

  let payload: { data?: T; error?: { code: string; message: string; details?: unknown } } = {};
  try {
    payload = response.status === 204 ? {} : await response.json();
  } catch {
    // fall through to the generic error below
  }

  if (response.ok) return { ok: true, status: response.status, data: payload.data as T };
  return {
    ok: false,
    status: response.status,
    error: payload.error ?? { code: "unknown", message: "Something went wrong. Please try again." },
  };
}

export const postJson = <T>(url: string, body: unknown) => requestJson<T>("POST", url, body);
export const getJson = <T>(url: string) => requestJson<T>("GET", url);
