import { describe, expect, it } from "vitest";
import { codeStatus, generateCode, parseCsv } from "@/lib/services/admin-alumni";

describe("generateCode", () => {
  it("makes readable codes without confusable characters", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^IBA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
});

describe("codeStatus", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const base = { claimedById: null, revokedAt: null, expiresAt: null };
  it("works out each status", () => {
    expect(codeStatus(base, now)).toBe("active");
    expect(codeStatus({ ...base, expiresAt: new Date("2026-11-18T09:00:00Z") }, now)).toBe("expired");
    expect(codeStatus({ ...base, revokedAt: now }, now)).toBe("revoked");
    expect(codeStatus({ ...base, claimedById: "u", revokedAt: now }, now)).toBe("claimed");
  });
});

describe("parseCsv", () => {
  it("handles quotes, embedded commas, escaped quotes and blank lines", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\nlast,row')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["last", "row"],
    ]);
  });
});
