import { describe, expect, it } from "vitest";
import { databaseUrlWarning, poolConfig } from "@/lib/db-config";

const url = "postgresql://user:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

describe("poolConfig", () => {
  it("keeps the settings the app already ran with, plus a query timeout", () => {
    expect(poolConfig(url, {})).toEqual({
      connectionString: url,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      query_timeout: 20_000,
    });
  });

  it("does not set a pool size or idle timeout unless asked, so the pg defaults stay", () => {
    const config = poolConfig(url, {});
    expect(config).not.toHaveProperty("max");
    expect(config).not.toHaveProperty("idleTimeoutMillis");
  });

  it("takes overrides from the environment", () => {
    const config = poolConfig(url, {
      DATABASE_POOL_MAX: "4",
      DATABASE_IDLE_TIMEOUT_MS: "5000",
      DATABASE_CONNECT_TIMEOUT_MS: "3000",
      DATABASE_QUERY_TIMEOUT_MS: "8000",
    });
    expect(config).toMatchObject({ max: 4, idleTimeoutMillis: 5000, connectionTimeoutMillis: 3000, query_timeout: 8000 });
  });

  it("allows switching the query timeout off", () => {
    expect(poolConfig(url, { DATABASE_QUERY_TIMEOUT_MS: "0" })).not.toHaveProperty("query_timeout");
  });

  it("ignores values that make no sense instead of breaking the app", () => {
    const config = poolConfig(url, {
      DATABASE_POOL_MAX: "0",
      DATABASE_CONNECT_TIMEOUT_MS: "banana",
      DATABASE_QUERY_TIMEOUT_MS: "-1",
      DATABASE_IDLE_TIMEOUT_MS: "1.5",
    });
    expect(config).toEqual({ connectionString: url, connectionTimeoutMillis: 10_000, keepAlive: true, query_timeout: 20_000 });
  });
});

describe("databaseUrlWarning", () => {
  it("accepts the transaction pooler", () => {
    expect(databaseUrlWarning(url)).toBeNull();
  });

  it("warns about a direct Supabase connection", () => {
    expect(databaseUrlWarning("postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres")).toMatch(/direct Supabase connection/);
  });

  it("warns about the session pooler on 5432", () => {
    expect(databaseUrlWarning("postgresql://u:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")).toMatch(/session mode/);
  });

  it("says nothing about other hosts, local databases or unreadable values", () => {
    expect(databaseUrlWarning("postgresql://postgres:pw@localhost:5432/ibatest")).toBeNull();
    expect(databaseUrlWarning("postgresql://u:pw@db.internal.example.com:5432/app")).toBeNull();
    expect(databaseUrlWarning("not a url")).toBeNull();
  });

  it("never repeats credentials or the host", () => {
    const warning = databaseUrlWarning("postgresql://secretuser:secretpw@db.abcdefgh.supabase.co:5432/postgres")!;
    for (const secret of ["secretuser", "secretpw", "abcdefgh"]) expect(warning).not.toContain(secret);
  });
});
