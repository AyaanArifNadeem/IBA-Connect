import { expect, test } from "@playwright/test";

test("GET /api/v1/health answers with the standard JSON shape", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const body = await res.json();
  expect(body.data.status).toBe("ok");
});

test("unknown API routes return 404", async ({ request }) => {
  const res = await request.get("/api/v1/does-not-exist");
  expect(res.status()).toBe(404);
});
