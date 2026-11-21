/* eslint-disable @typescript-eslint/no-explicit-any -- API responses are read loosely in these end-to-end checks */
import { type APIRequestContext, type TestInfo, request } from "@playwright/test";
import { BASE_URL, type Login, freshIp, statePath } from "./helpers";

const contexts = new Map<string, APIRequestContext>();

/** An API client signed in as one of the test logins (or signed out with "anon"). */
export async function as(who: Login | "anon"): Promise<APIRequestContext> {
  const existing = contexts.get(who);
  if (existing) return existing;
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    storageState: who === "anon" ? undefined : statePath(who),
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
  });
  contexts.set(who, ctx);
  return ctx;
}

/** A signed-out client with its own IP, for sign-in attempts. */
export async function fresh(ip = freshIp()) {
  return request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-forwarded-for": ip } });
}

export async function disposeAll() {
  for (const ctx of contexts.values()) await ctx.dispose();
  contexts.clear();
}

/** Record what actually happened, for the test results table. */
export function actual(info: TestInfo, text: string) {
  info.annotations.push({ type: "actual", description: text });
}

export async function json(res: { json(): Promise<unknown> }) {
  return (await res.json().catch(() => ({}))) as { data?: any; error?: { code: string; message: string; details?: { path: string; message: string }[] } };
}
