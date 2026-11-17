import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resetDatabase, testDb } from "./helpers";

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
});
