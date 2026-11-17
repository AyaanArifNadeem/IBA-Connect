import { describe, expect, it } from "vitest";
import { Role, UserStatus } from "@/lib/generated/prisma/enums";
import { assertAccess, isIbaEmail, type AuthIdentity } from "@/lib/auth/access";

const identity: AuthIdentity = { id: "u1", email: "a@khi.iba.edu.pk", emailVerified: true };
const member = {
  id: "u1",
  role: Role.STUDENT,
  status: UserStatus.ACTIVE,
  profileCompletedAt: new Date(),
  deletedAt: null,
};

describe("assertAccess (server-side guard, NFR7)", () => {
  it("lets an active member with a finished profile through", () => {
    expect(() => assertAccess(identity, member)).not.toThrow();
  });

  it("refuses when nobody is signed in", () => {
    expect(() => assertAccess(null, null)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("refuses an unverified email (US1.2)", () => {
    expect(() => assertAccess({ ...identity, emailVerified: false }, member)).toThrow(
      expect.objectContaining({ code: "email_not_verified" }),
    );
  });

  it("refuses a suspended member (FR1.6, FR8.3)", () => {
    expect(() => assertAccess(identity, { ...member, status: UserStatus.SUSPENDED })).toThrow(
      expect.objectContaining({ status: 403, code: "suspended" }),
    );
  });

  it("refuses a deactivated or deleted account", () => {
    expect(() => assertAccess(identity, { ...member, status: UserStatus.DEACTIVATED })).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    expect(() => assertAccess(identity, { ...member, deletedAt: new Date() })).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("asks for profile setup until the profile is finished (US1.5)", () => {
    const fresh = { ...member, profileCompletedAt: null };
    expect(() => assertAccess(identity, fresh)).toThrow(expect.objectContaining({ code: "profile_incomplete" }));
    expect(() => assertAccess(identity, fresh, { profileComplete: false })).not.toThrow();
  });

  it("allows admin-only actions for admins only (FR8.5)", () => {
    expect(() => assertAccess(identity, member, { admin: true })).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
    expect(() => assertAccess(identity, { ...member, role: Role.ADMIN }, { admin: true })).not.toThrow();
  });
});

describe("isIbaEmail (FR1.1, NFR8)", () => {
  const domain = "khi.iba.edu.pk";

  it("accepts the IBA domain in any letter case", () => {
    expect(isIbaEmail("s.raza@khi.iba.edu.pk", domain)).toBe(true);
    expect(isIbaEmail("S.Raza@KHI.IBA.EDU.PK", domain)).toBe(true);
  });

  it("rejects other domains, including look-alikes", () => {
    expect(isIbaEmail("someone@gmail.com", domain)).toBe(false);
    expect(isIbaEmail("x@evil-khi.iba.edu.pk", domain)).toBe(false);
    expect(isIbaEmail("x@khi.iba.edu.pk.evil.com", domain)).toBe(false);
    expect(isIbaEmail("@khi.iba.edu.pk", domain)).toBe(false);
    expect(isIbaEmail("no-at-sign", domain)).toBe(false);
  });
});
