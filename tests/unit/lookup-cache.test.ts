import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOOKUP_TTL_MS, lookupCache, lookupTtlMs } from "@/lib/lookup-cache";

afterEach(() => vi.unstubAllEnvs());

describe("lookupCache", () => {
  it("loads once and reuses the result until it expires", async () => {
    const load = vi.fn().mockResolvedValue(["a"]);
    const cache = lookupCache(load);
    expect(await cache.get(0)).toEqual(["a"]);
    expect(await cache.get(DEFAULT_LOOKUP_TTL_MS - 1)).toEqual(["a"]);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get(DEFAULT_LOOKUP_TTL_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between simultaneous callers", async () => {
    let resolve!: (v: string[]) => void;
    const load = vi.fn(() => new Promise<string[]>((r) => (resolve = r)));
    const cache = lookupCache(load);
    const both = Promise.all([cache.get(0), cache.get(1)]);
    resolve(["x"]);
    expect(await both).toEqual([["x"], ["x"]]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("invalidate() makes the next read load again", async () => {
    const load = vi.fn().mockResolvedValueOnce(["old"]).mockResolvedValueOnce(["new"]);
    const cache = lookupCache(load);
    expect(await cache.get(0)).toEqual(["old"]);
    cache.invalidate();
    expect(await cache.get(1)).toEqual(["new"]);
  });

  it("an invalidate during a load is not undone when that load finishes", async () => {
    let resolveOld!: (v: string[]) => void;
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string[]>((r) => (resolveOld = r)))
      .mockResolvedValueOnce(["fresh"]);
    const cache = lookupCache(load);
    const stale = cache.get(0); // started before the change was committed
    cache.invalidate(); // the change is committed
    resolveOld(["stale"]);
    await stale;
    expect(await cache.get(1)).toEqual(["fresh"]);
  });

  it("does not keep a failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(["ok"]);
    const cache = lookupCache(load);
    await expect(cache.get(0)).rejects.toThrow("db down");
    expect(await cache.get(1)).toEqual(["ok"]);
  });

  it("LOOKUP_CACHE_TTL_MS=0 switches caching off, and nonsense falls back to the default", async () => {
    vi.stubEnv("LOOKUP_CACHE_TTL_MS", "0");
    const load = vi.fn().mockResolvedValue([]);
    const cache = lookupCache(load);
    await cache.get(0);
    await cache.get(0);
    expect(load).toHaveBeenCalledTimes(2);
    vi.stubEnv("LOOKUP_CACHE_TTL_MS", "banana");
    expect(lookupTtlMs()).toBe(DEFAULT_LOOKUP_TTL_MS);
    vi.stubEnv("LOOKUP_CACHE_TTL_MS", "-5");
    expect(lookupTtlMs()).toBe(DEFAULT_LOOKUP_TTL_MS);
  });
});
