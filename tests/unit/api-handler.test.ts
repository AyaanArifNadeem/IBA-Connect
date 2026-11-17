import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { forbidden, rateLimited } from "@/lib/api/errors";
import { created, errorResponse, ok, route } from "@/lib/api/handler";
import { clientIp, parseJson, parseQuery } from "@/lib/api/validation";

const json = (res: Response) => res.json() as Promise<{ data?: unknown; error?: { code: string; message: string; details?: unknown } }>;

describe("API responses (SRS 5.4)", () => {
  it("wraps data and never caches", async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({ data: { a: 1 } });
    expect(created({}).status).toBe(201);
  });

  it("turns an ApiError into the standard error shape", async () => {
    const res = errorResponse(forbidden());
    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({
      error: { code: "forbidden", message: "You do not have permission to do that." },
    });
  });

  it("adds Retry-After to rate-limit errors", () => {
    const res = errorResponse(rateLimited("Slow down", 42.2));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("43");
  });

  it("reports which fields failed validation", async () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    const res = errorResponse(result.error);
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("validation_failed");
    expect(body.error?.details).toEqual([{ path: "name", message: expect.any(String) }]);
  });

  it("maps a unique-constraint violation to 409", async () => {
    const res = errorResponse(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(res.status).toBe(409);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("database password is hunter2"));
    const body = await json(res);
    expect(res.status).toBe(500);
    expect(body.error?.message).not.toContain("hunter2");
    spy.mockRestore();
  });

  it("route() catches errors thrown by the handler", async () => {
    const handler = route(async () => {
      throw forbidden();
    });
    const res = await handler(new Request("http://x/api"), {});
    expect(res.status).toBe(403);
  });
});

describe("request parsing", () => {
  const schema = z.object({ title: z.string() });

  it("parses a valid JSON body", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ title: "hi" }) });
    await expect(parseJson(req, schema)).resolves.toEqual({ title: "hi" });
  });

  it("rejects a body that is not JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "not json" });
    await expect(parseJson(req, schema)).rejects.toMatchObject({ status: 400, code: "bad_request" });
  });

  it("collects repeated query keys into arrays", () => {
    const req = new Request("http://x/?course=A&course=B&page=2");
    const parsed = parseQuery(
      req,
      z.object({ course: z.array(z.string()), page: z.coerce.number() }),
    );
    expect(parsed).toEqual({ course: ["A", "B"], page: 2 });
  });

  it("reads the client IP from the first forwarded address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.5");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
