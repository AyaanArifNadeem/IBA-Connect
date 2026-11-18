import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/** Keeps docs/api/openapi.yaml in step with the route handlers in app/api/v1 (SRS 2.6). */
const root = join(__dirname, "..", "..");
const spec = parse(readFileSync(join(root, "docs/api/openapi.yaml"), "utf8"));
const apiDir = join(root, "app/api/v1");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? routeFiles(full) : entry === "route.ts" ? [full] : [];
  });
}

const routes = routeFiles(apiDir).map((file) => {
  const path = "/" + relative(apiDir, file).split(sep).slice(0, -1).join("/").replace(/\[(\w+)\]/g, "{$1}");
  const source = readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1].toLowerCase());
  return { path, methods };
});

describe("OpenAPI spec", () => {
  it("is OpenAPI 3.1 with the standard error shape", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.components.schemas.Error.properties.error.required).toEqual(["code", "message"]);
  });

  it.each(routes)("documents every method of $path", ({ path, methods }) => {
    expect(spec.paths[path], `missing path ${path}`).toBeDefined();
    for (const method of methods) expect(spec.paths[path][method], `missing ${method.toUpperCase()} ${path}`).toBeDefined();
  });

  it("documents no routes that do not exist", () => {
    const real = new Set(routes.flatMap((r) => r.methods.map((m) => `${m} ${r.path}`)));
    const documented = Object.entries(spec.paths as Record<string, Record<string, unknown>>).flatMap(([path, ops]) =>
      Object.keys(ops)
        .filter((k) => ["get", "post", "put", "patch", "delete"].includes(k))
        .map((m) => `${m} ${path}`),
    );
    expect(documented.filter((d) => !real.has(d))).toEqual([]);
  });

  it("only references schemas that exist", () => {
    const text = readFileSync(join(root, "docs/api/openapi.yaml"), "utf8");
    const refs = [...text.matchAll(/#\/components\/(\w+)\/(\w+)/g)];
    for (const [, group, name] of refs) expect(spec.components[group]?.[name], `${group}/${name}`).toBeDefined();
  });
});
