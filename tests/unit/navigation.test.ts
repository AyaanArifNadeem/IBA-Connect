import { describe, expect, it } from "vitest";
import { MAIN_NAV, formatBadgeCount, initialsOf, isActivePath } from "@/lib/navigation";

describe("isActivePath", () => {
  it("matches the page itself and its sub-pages", () => {
    expect(isActivePath("/directory", "/directory")).toBe(true);
    expect(isActivePath("/messages/ali-khan", "/messages")).toBe(true);
  });

  it("does not match a different page that shares a prefix", () => {
    expect(isActivePath("/boards", "/board")).toBe(false);
    expect(isActivePath("/dashboard", "/directory")).toBe(false);
  });
});

describe("formatBadgeCount", () => {
  it("hides the badge at zero or below", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-3)).toBeNull();
  });

  it("caps large counts", () => {
    expect(formatBadgeCount(7)).toBe("7");
    expect(formatBadgeCount(150)).toBe("99+");
  });
});

describe("initialsOf", () => {
  it("uses first and last name", () => {
    expect(initialsOf("Sara Raza")).toBe("SR");
    expect(initialsOf("  muhammad ali khan ")).toBe("MK");
  });

  it("handles one name and an empty name", () => {
    expect(initialsOf("Ayesha")).toBe("A");
    expect(initialsOf("")).toBe("?");
  });
});

describe("MAIN_NAV", () => {
  it("puts every Sprint 1 screen one click from any page (NFR14)", () => {
    expect(MAIN_NAV.map((i) => i.href)).toEqual([
      "/dashboard",
      "/directory",
      "/board",
      "/messages",
      "/requests",
    ]);
  });
});
