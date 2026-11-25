import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit } from "@/lib/rate-limit";
import { makeUser, resetDatabase, testDb } from "./helpers";

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

const rule = { key: "test:sign-in:203.0.113.5", limit: 3, windowMs: 60_000 };

describe("enforceRateLimit (NFR20)", () => {
  it("allows hits up to the limit, then refuses with Retry-After", async () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    for (let i = 0; i < 3; i++) {
      await enforceRateLimit(rule, new Date(t0.getTime() + i * 1000));
    }

    await expect(enforceRateLimit(rule, new Date(t0.getTime() + 5000))).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 55,
    });
  });

  it("allows hits again once the window has passed", async () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    for (let i = 0; i < 3; i++) await enforceRateLimit(rule, t0);

    await expect(enforceRateLimit(rule, new Date(t0.getTime() + 61_000))).resolves.toBeUndefined();
  });

  it("counts each key separately", async () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    for (let i = 0; i < 3; i++) await enforceRateLimit(rule, t0);

    await expect(enforceRateLimit({ ...rule, key: "test:sign-in:198.51.100.7" }, t0)).resolves.toBeUndefined();
  });

  it("does not record a hit when refusing", async () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    for (let i = 0; i < 3; i++) await enforceRateLimit(rule, t0);
    await enforceRateLimit(rule, t0).catch(() => {});

    expect(await testDb.rateLimitHit.count({ where: { key: rule.key } })).toBe(3);
  });

  it("never lets simultaneous requests exceed the limit", async () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => enforceRateLimit(rule, t0)));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(9);
    expect(await testDb.rateLimitHit.count({ where: { key: rule.key } })).toBe(3);
  });

  it("stores the user and the time of the hit", async () => {
    const user = await makeUser();
    const t0 = new Date("2026-11-17T10:00:00.123Z");
    await enforceRateLimit({ ...rule, userId: user.id }, t0);

    const hit = await testDb.rateLimitHit.findFirstOrThrow({ where: { key: rule.key } });
    expect(hit.userId).toBe(user.id);
    expect(hit.createdAt.toISOString()).toBe("2026-11-17T10:00:00.123Z");
  });
});
