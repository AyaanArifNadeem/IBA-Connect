import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript build script
import { currentDot, parseSchema } from "../../scripts/erd.mjs";

const root = join(__dirname, "..", "..");

describe("ERD (docs/architecture)", () => {
  it("matches prisma/schema.prisma (run npm run docs:erd after changing the schema)", () => {
    const saved = readFileSync(join(root, "docs/architecture/erd.dot"), "utf8").replace(/\r\n/g, "\n");
    expect(saved).toBe(currentDot());
  });

  it("reads every model, key and relation", () => {
    const { models } = parseSchema(readFileSync(join(root, "prisma/schema.prisma"), "utf8"));
    const names = models.map((m: { name: string }) => m.name);
    expect(names).toEqual(expect.arrayContaining(["User", "Connection", "Message", "Post", "PostResponse", "Block"]));
    const connection = models.find((m: { name: string }) => m.name === "Connection");
    const field = (n: string) => connection.fields.find((f: { name: string }) => f.name === n);
    expect(field("id").id).toBe(true);
    expect(field("requesterId").fk).toBe(true);
    expect(field("requester").isRelation).toBe(true);
    const userSkill = models.find((m: { name: string }) => m.name === "UserSkill");
    expect(userSkill.fields.filter((f: { id: boolean }) => f.id).map((f: { name: string }) => f.name)).toEqual(["userId", "skillId"]);
  });
});
