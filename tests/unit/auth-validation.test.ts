import { describe, expect, it } from "vitest";
import { hasIbaDomain, passwordSchema, registerSchema, safeNextPath, signInSchema } from "@/lib/validation/auth";

describe("passwordSchema (FR1.2)", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordSchema.safeParse("Str0ng!Pass").success).toBe(true);
  });

  it.each([
    ["too short", "Ab1!xyz"],
    ["no upper case", "str0ng!pass"],
    ["no lower case", "STR0NG!PASS"],
    ["no digit", "Strong!Pass"],
    ["no symbol", "Str0ngPass1"],
    ["contains a space", "Str0ng! Pass"],
    ["longer than 72", `Aa1!${"x".repeat(70)}`],
  ])("TC-005: rejects a password that is %s", (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const schema = registerSchema("khi.iba.edu.pk");

  it("TC-004: accepts a valid IBA registration and normalises the email", () => {
    const result = schema.parse({ name: "  Sara Raza ", email: " Sara.Raza@KHI.iba.edu.pk ", password: "Str0ng!Pass" });
    expect(result).toEqual({ name: "Sara Raza", email: "sara.raza@khi.iba.edu.pk", password: "Str0ng!Pass" });
  });

  it("rejects an email outside the IBA domain", () => {
    const result = schema.safeParse({ name: "Sara", email: "sara@gmail.com", password: "Str0ng!Pass" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Only @khi.iba.edu.pk accounts can join");
  });

  it("rejects a missing name", () => {
    expect(schema.safeParse({ name: " ", email: "s@khi.iba.edu.pk", password: "Str0ng!Pass" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("does not apply the registration password rules", () => {
    expect(signInSchema.safeParse({ email: "a@khi.iba.edu.pk", password: "old" }).success).toBe(true);
  });
});

describe("hasIbaDomain", () => {
  it("matches the exact domain only", () => {
    expect(hasIbaDomain("a@khi.iba.edu.pk")).toBe(true);
    expect(hasIbaDomain("a@iba.edu.pk")).toBe(false);
    expect(hasIbaDomain("a@khi.iba.edu.pk.evil.test")).toBe(false);
  });
});

describe("safeNextPath (no open redirects)", () => {
  it("keeps paths inside the app", () => {
    expect(safeNextPath("/directory?course=CSE341")).toBe("/directory?course=CSE341");
  });

  it("falls back for external or protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.test")).toBe("/dashboard");
    expect(safeNextPath("//evil.test")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.test")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});
