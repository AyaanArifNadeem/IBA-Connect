import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.fn();
const createSignedUrls = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl, createSignedUrls, remove }) } }),
}));

import { URL_CACHE_MAX, URL_CACHE_TTL_MS, avatarUrl, avatarUrls, clearAvatarUrlCache, deleteAvatar } from "@/lib/storage/avatars";

const MIN = 60_000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  clearAvatarUrlCache();
  createSignedUrl.mockReset();
  createSignedUrls.mockReset();
  remove.mockReset();
  let n = 0;
  createSignedUrl.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://s.test/${path}?t=${++n}` }, error: null }));
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://s.test/${path}?t=${++n}`, error: null })),
    error: null,
  }));
  remove.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("avatarUrl cache", () => {
  it("signs a path once and reuses the link", async () => {
    const first = await avatarUrl("u1/a.png");
    expect(await avatarUrl("u1/a.png")).toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("asks for a new link before the old one can expire", async () => {
    const first = await avatarUrl("u1/a.png");
    vi.advanceTimersByTime(URL_CACHE_TTL_MS - MIN);
    expect(await avatarUrl("u1/a.png")).toBe(first);
    vi.advanceTimersByTime(2 * MIN);
    expect(await avatarUrl("u1/a.png")).not.toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    // a cached link always has at least 15 of its 60 minutes left
    expect(60 * MIN - URL_CACHE_TTL_MS).toBeGreaterThanOrEqual(15 * MIN);
  });

  it("does not cache a failure", async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await avatarUrl("u1/a.png")).toBeNull();
    expect(await avatarUrl("u1/a.png")).toMatch(/^https:\/\/s\.test\//);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("returns null without a path or without storage configured, and never calls Storage", async () => {
    expect(await avatarUrl(null)).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await avatarUrl("u1/a.png")).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("forgets a deleted avatar", async () => {
    await avatarUrl("u1/a.png");
    await deleteAvatar("u1/a.png");
    await avatarUrl("u1/a.png");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("a replaced photo has a new path, so it gets its own link", async () => {
    const old = await avatarUrl("u1/old.png");
    const next = await avatarUrl("u1/new.png");
    expect(next).not.toBe(old);
    expect(next).toContain("u1/new.png");
  });
});

describe("avatarUrls (batch) cache", () => {
  it("signs only what is not cached, in a single call", async () => {
    await avatarUrls(["a.png", "b.png"]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    const second = await avatarUrls(["a.png", "b.png", "c.png", null, undefined, "a.png"]);
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    expect(createSignedUrls.mock.calls[1][0]).toEqual(["c.png"]);
    expect([...second.keys()].sort()).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("makes no Storage call when everything is cached", async () => {
    await avatarUrls(["a.png", "b.png"]);
    createSignedUrls.mockClear();
    const urls = await avatarUrls(["b.png", "a.png"]);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(urls.size).toBe(2);
  });

  it("shares links with the single-path helper", async () => {
    const urls = await avatarUrls(["a.png"]);
    expect(await avatarUrl("a.png")).toBe(urls.get("a.png"));
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns what is cached when the batch call fails, and still fails closed for the rest", async () => {
    await avatarUrls(["a.png"]);
    createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    const urls = await avatarUrls(["a.png", "b.png"]);
    expect([...urls.keys()]).toEqual(["a.png"]);
  });

  it("returns an empty map for no paths", async () => {
    expect((await avatarUrls([null, undefined])).size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

describe("cache size", () => {
  it(`keeps at most ${URL_CACHE_MAX} links and drops the least recently used`, async () => {
    for (let i = 0; i < URL_CACHE_MAX; i++) await avatarUrl(`p${i}.png`);
    await avatarUrl("p0.png"); // p0 is now the most recently used
    await avatarUrl("extra.png"); // pushes out p1, the least recently used
    createSignedUrl.mockClear();
    await avatarUrl("p0.png");
    expect(createSignedUrl).not.toHaveBeenCalled();
    await avatarUrl("p1.png");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
});
